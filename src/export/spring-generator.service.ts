import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

interface ModelNodeAttr {
  id: string;
  name: string;
  type: string;
  visibility?: string;
}

interface ModelNode {
  id: string;
  data: {
    label: string;
    methods?: any[];
    attributes?: ModelNodeAttr[];
  };
}

interface ModelEdge {
  data?: {
    type?: string;
    label?: string;
    sourceCardinality?: string;
    targetCardinality?: string;
  };
  type?: string;
  source: string;
  target: string;
}

interface DiagramModel {
  nodes: ModelNode[];
  edges: ModelEdge[];
  metadata?: any;
}

@Injectable()
export class SpringGeneratorService {
  async generateFromModel(
    model: DiagramModel,
    outputRoot?: string,
  ): Promise<void> {
    // compute base package path in the output root (defaults to demo project)
    const basePackagePath = outputRoot
      ? path.join(outputRoot, 'src', 'main', 'java', 'com', 'example', 'demo')
      : path.join(
          process.cwd(),
          'demo',
          'src',
          'main',
          'java',
          'com',
          'example',
          'demo',
        );

    // if generating into an explicit outputRoot, copy template skeleton from demo/
    if (outputRoot) {
      const templateRoot = path.join(process.cwd(), 'demo');
      // copy pom.xml
      try {
        const pomSrc = path.join(templateRoot, 'pom.xml');
        if (fs.existsSync(pomSrc)) {
          this.ensureDir(outputRoot);
          fs.copyFileSync(pomSrc, path.join(outputRoot, 'pom.xml'));
        }
        // copy mvnw and mvnw.cmd
        const mvnw = path.join(templateRoot, 'mvnw');
        if (fs.existsSync(mvnw)) {
          fs.copyFileSync(mvnw, path.join(outputRoot, 'mvnw'));
          fs.chmodSync(path.join(outputRoot, 'mvnw'), 0o755);
        }
        const mvnwCmd = path.join(templateRoot, 'mvnw.cmd');
        if (fs.existsSync(mvnwCmd)) {
          fs.copyFileSync(mvnwCmd, path.join(outputRoot, 'mvnw.cmd'));
        }

        // copy .mvn folder if exists
        const mvnFolder = path.join(templateRoot, '.mvn');
        if (fs.existsSync(mvnFolder)) {
          this.copyRecursiveSync(mvnFolder, path.join(outputRoot, '.mvn'));
        }

        // copy resources
        const resourcesSrc = path.join(
          templateRoot,
          'src',
          'main',
          'resources',
        );
        if (fs.existsSync(resourcesSrc)) {
          this.copyRecursiveSync(
            resourcesSrc,
            path.join(outputRoot, 'src', 'main', 'resources'),
          );
        }

        // copy DemoApplication.java (application entry)
        const demoAppSrc = path.join(
          templateRoot,
          'src',
          'main',
          'java',
          'com',
          'example',
          'demo',
          'DemoApplication.java',
        );
        if (fs.existsSync(demoAppSrc)) {
          const demoAppDestDir = path.join(
            outputRoot,
            'src',
            'main',
            'java',
            'com',
            'example',
            'demo',
          );
          this.ensureDir(demoAppDestDir);
          fs.copyFileSync(
            demoAppSrc,
            path.join(demoAppDestDir, 'DemoApplication.java'),
          );
        }
      } catch (err) {
        // non-fatal: continue generation even if template copy fails
        console.warn('Warning copying template files:', err);
      }
    }

    // ensure base folders
    this.ensureDir(basePackagePath);
    const modelDir = path.join(basePackagePath, 'model');
    const repoDir = path.join(basePackagePath, 'repository');
    const serviceDir = path.join(basePackagePath, 'service');
    const controllerDir = path.join(basePackagePath, 'controller');
    this.ensureDir(modelDir);
    this.ensureDir(repoDir);
    this.ensureDir(serviceDir);
    this.ensureDir(controllerDir);

    const nodes = model.nodes || [];
    const edges = model.edges || [];

    // Prepare maps
    const nodeIdToClass: Record<string, string> = {};
    const attributesMap: Record<string, ModelNodeAttr[]> = {};
    for (const node of nodes) {
      const className = this.sanitizeClassName(node.data.label);
      nodeIdToClass[node.id] = className;
      attributesMap[className] = node.data.attributes || [];
    }

    // relations map: className -> list of field strings and imports
    const relationsMap: Record<
      string,
      { fields: string[]; imports: Set<string> }
    > = {};
    for (const node of nodes) {
      const className = nodeIdToClass[node.id];
      relationsMap[className] = { fields: [], imports: new Set() };
    }

    const isMany = (card?: string) => !!card && card.includes('*');

    for (const edge of edges) {
      const sourceId = edge.source;
      const targetId = edge.target;
      const sourceClass = nodeIdToClass[sourceId];
      const targetClass = nodeIdToClass[targetId];
      if (!sourceClass || !targetClass) continue;

      const sourceCard = edge.data?.sourceCardinality;
      const targetCard = edge.data?.targetCardinality;

      // Interpret cardinalities: targetCard '*' means source has many targets (source -> List<Target>)
      const sourceHasManyTargets = isMany(targetCard);
      const targetHasManySources = isMany(sourceCard);

      // names
      const sourceLower =
        sourceClass.charAt(0).toLowerCase() + sourceClass.slice(1);
      const targetLower =
        targetClass.charAt(0).toLowerCase() + targetClass.slice(1);

      if (sourceHasManyTargets && targetHasManySources) {
        // Many-to-Many: make source owning side
        relationsMap[sourceClass].imports.add('java.util.List');
        relationsMap[sourceClass].imports.add('jakarta.persistence.ManyToMany');
        relationsMap[sourceClass].imports.add('jakarta.persistence.JoinTable');
        relationsMap[sourceClass].imports.add('jakarta.persistence.JoinColumn');
        relationsMap[sourceClass].imports.add(
          'com.fasterxml.jackson.annotation.JsonManagedReference',
        );
        relationsMap[sourceClass].fields.push(
          `    @ManyToMany\n    @JoinTable(name = "${sourceLower}_${targetLower}", joinColumns = @JoinColumn(name = "${sourceLower}_id"), inverseJoinColumns = @JoinColumn(name = "${targetLower}_id"))\n    @JsonManagedReference\n    private List<${targetClass}> ${targetLower}s;`,
        );

        relationsMap[targetClass].imports.add('java.util.List');
        relationsMap[targetClass].imports.add('jakarta.persistence.ManyToMany');
        relationsMap[targetClass].imports.add(
          'com.fasterxml.jackson.annotation.JsonBackReference',
        );
        relationsMap[targetClass].fields.push(
          `    @ManyToMany(mappedBy = "${targetLower}s")\n    @JsonBackReference\n    private List<${sourceClass}> ${sourceLower}s;`,
        );
      } else if (sourceHasManyTargets) {
        // source has List<target>, target has ManyToOne to source
        relationsMap[sourceClass].imports.add('java.util.List');
        relationsMap[sourceClass].imports.add('jakarta.persistence.OneToMany');
        relationsMap[sourceClass].imports.add(
          'com.fasterxml.jackson.annotation.JsonManagedReference',
        );
        relationsMap[sourceClass].fields.push(
          `    @OneToMany(mappedBy = "${sourceLower}")\n    @JsonManagedReference\n    private List<${targetClass}> ${targetLower}s;`,
        );

        relationsMap[targetClass].imports.add('jakarta.persistence.ManyToOne');
        relationsMap[targetClass].imports.add('jakarta.persistence.JoinColumn');
        relationsMap[targetClass].imports.add(
          'com.fasterxml.jackson.annotation.JsonBackReference',
        );
        relationsMap[targetClass].fields.push(
          `    @ManyToOne\n    @JoinColumn(name = "${sourceLower}_id")\n    @JsonBackReference\n    private ${sourceClass} ${sourceLower};`,
        );
      } else if (targetHasManySources) {
        // target has List<source>, source has ManyToOne to target
        relationsMap[targetClass].imports.add('java.util.List');
        relationsMap[targetClass].imports.add('jakarta.persistence.OneToMany');
        relationsMap[targetClass].imports.add(
          'com.fasterxml.jackson.annotation.JsonManagedReference',
        );
        relationsMap[targetClass].fields.push(
          `    @OneToMany(mappedBy = "${targetLower}")\n    @JsonManagedReference\n    private List<${sourceClass}> ${sourceLower}s;`,
        );

        relationsMap[sourceClass].imports.add('jakarta.persistence.ManyToOne');
        relationsMap[sourceClass].imports.add('jakarta.persistence.JoinColumn');
        relationsMap[sourceClass].imports.add(
          'com.fasterxml.jackson.annotation.JsonBackReference',
        );
        relationsMap[sourceClass].fields.push(
          `    @ManyToOne\n    @JoinColumn(name = "${targetLower}_id")\n    @JsonBackReference\n    private ${targetClass} ${targetLower};`,
        );
      } else {
        // One-to-One (default)
        relationsMap[sourceClass].imports.add('jakarta.persistence.OneToOne');
        relationsMap[sourceClass].imports.add('jakarta.persistence.JoinColumn');
        relationsMap[sourceClass].imports.add(
          'com.fasterxml.jackson.annotation.JsonManagedReference',
        );
        relationsMap[sourceClass].fields.push(
          `    @OneToOne\n    @JoinColumn(name = "${targetLower}_id")\n    @JsonManagedReference\n    private ${targetClass} ${targetLower};`,
        );

        relationsMap[targetClass].imports.add('jakarta.persistence.OneToOne');
        relationsMap[targetClass].fields.push(
          `    @OneToOne(mappedBy = "${targetLower}")\n    @JsonBackReference\n    private ${sourceClass} ${sourceLower};`,
        );
      }
    }

    // Generate files with relations
    for (const node of nodes) {
      const className = nodeIdToClass[node.id];
      const attributes = attributesMap[className] || [];
      const rel = relationsMap[className];
      const java = this.buildEntityWithRelations(className, attributes, rel);
      fs.writeFileSync(path.join(modelDir, `${className}.java`), java, 'utf8');

      const repo = this.buildRepository(className);
      fs.writeFileSync(
        path.join(repoDir, `${className}Repository.java`),
        repo,
        'utf8',
      );

      const svc = this.buildService(className);
      fs.writeFileSync(
        path.join(serviceDir, `${className}Service.java`),
        svc,
        'utf8',
      );

      const ctrl = this.buildController(className);
      fs.writeFileSync(
        path.join(controllerDir, `${className}Controller.java`),
        ctrl,
        'utf8',
      );
    }
  }

  private ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private copyRecursiveSync(src: string, dest: string) {
    const exists = fs.existsSync(src);
    const stats = exists ? fs.statSync(src) : null;
    const isDirectory = stats ? stats.isDirectory() : false;
    if (isDirectory) {
      this.ensureDir(dest);
      fs.readdirSync(src).forEach((child) => {
        this.copyRecursiveSync(path.join(src, child), path.join(dest, child));
      });
    } else if (exists) {
      this.ensureDir(path.dirname(dest));
      fs.copyFileSync(src, dest);
    }
  }

  private sanitizeClassName(label: string) {
    // Assume label is valid and capitalize
    return label
      .replace(/[^a-zA-Z0-9]/g, '')
      .replace(/^(.)/, (c) => c.toUpperCase());
  }

  private mapType(attrType: string) {
    switch ((attrType || '').toLowerCase()) {
      case 'int':
      case 'integer':
        return 'Integer';
      case 'long':
        return 'Long';
      case 'string':
      default:
        return 'String';
    }
  }

  private buildEntity(className: string, attributes: ModelNodeAttr[]) {
    const fields: string[] = [];
    let hasId = attributes && attributes.some((a) => a.name === 'id');
    if (!hasId) {
      fields.push(
        `    @Id\n    @GeneratedValue(strategy = GenerationType.IDENTITY)\n    private Long id;`,
      );
    } else {
      // keep id but always use Long to be consistent with services
      fields.push(`    @Id\n    private Long id;`);
    }

    for (const attr of attributes) {
      if (attr.name === 'id') continue;
      const t = this.mapType(attr.type);
      fields.push(`    private ${t} ${attr.name};`);
    }

    const imports = [
      'import jakarta.persistence.*;',
      'import lombok.Data;',
      'import com.fasterxml.jackson.annotation.JsonManagedReference;',
    ];

    const body = `package com.example.demo.model;\n\n${imports.join('\n')}\n\n@Data\n@Entity\npublic class ${className} {\n${fields.join('\n\n')}\n}`;
    return body;
  }

  private buildRepository(className: string) {
    return `package com.example.demo.repository;\n\nimport com.example.demo.model.${className};\nimport org.springframework.data.jpa.repository.JpaRepository;\nimport org.springframework.stereotype.Repository;\n\n@Repository\npublic interface ${className}Repository extends JpaRepository<${className}, Long> {\n}\n`;
  }

  private buildService(className: string) {
    return `package com.example.demo.service;\n\nimport com.example.demo.model.${className};\nimport com.example.demo.repository.${className}Repository;\nimport org.springframework.stereotype.Service;\nimport java.util.List;\nimport java.util.Optional;\n\n@Service\npublic class ${className}Service {\n    private final ${className}Repository repository;\n\n    public ${className}Service(${className}Repository repository) {\n        this.repository = repository;\n    }\n\n    public List<${className}> findAll() {\n        return repository.findAll();\n    }\n\n    public Optional<${className}> findById(Long id) {\n        return repository.findById(id);\n    }\n\n    public ${className} create(${className} entity) {\n        return repository.save(entity);\n    }\n\n    public ${className} update(Long id, ${className} entity) {\n        entity.setId(id);\n        return repository.save(entity);\n    }\n\n    public void delete(Long id) {\n        repository.deleteById(id);\n    }\n}\n`;
  }

  private buildController(className: string) {
    const lower = className.charAt(0).toLowerCase() + className.slice(1);
    return `package com.example.demo.controller;\n\nimport com.example.demo.model.${className};\nimport com.example.demo.service.${className}Service;\nimport org.springframework.http.ResponseEntity;\nimport org.springframework.web.bind.annotation.*;\nimport java.util.List;\n\n@RestController\n@RequestMapping("/api/${lower}")\npublic class ${className}Controller {\n    private final ${className}Service service;\n\n    public ${className}Controller(${className}Service service) {\n        this.service = service;\n    }\n\n    @GetMapping\n    public List<${className}> all() {\n        return service.findAll();\n    }\n\n    @GetMapping("/{id}")\n    public ResponseEntity<${className}> get(@PathVariable Long id) {\n        return service.findById(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());\n    }\n\n    @PostMapping\n    public ${className} create(@RequestBody ${className} entity) {\n        return service.create(entity);\n    }\n\n    @PutMapping("/{id}")\n    public ${className} update(@PathVariable Long id, @RequestBody ${className} entity) {\n        return service.update(id, entity);\n    }\n\n    @DeleteMapping("/{id}")\n    public ResponseEntity<Void> delete(@PathVariable Long id) {\n        service.delete(id);\n        return ResponseEntity.noContent().build();\n    }\n}\n`;
  }

  private buildEntityWithRelations(
    className: string,
    attributes: ModelNodeAttr[],
    rel: { fields: string[]; imports: Set<string> } | undefined,
  ) {
    const fields: string[] = [];
    let hasId = attributes && attributes.some((a) => a.name === 'id');
    if (!hasId) {
      fields.push(
        `    @Id\n    @GeneratedValue(strategy = GenerationType.IDENTITY)\n    private Long id;`,
      );
    } else {
      // always use Long for id fields for consistency
      fields.push(`    @Id\n    private Long id;`);
    }

    for (const attr of attributes) {
      if (attr.name === 'id') continue;
      const t = this.mapType(attr.type);
      fields.push(`    private ${t} ${attr.name};`);
    }

    // add relation fields
    const relFields = rel?.fields || [];

    // build imports
    const imports = new Set<string>([
      'import jakarta.persistence.*;',
      'import lombok.Data;',
    ]);
    if (rel && rel.imports) {
      for (const imp of rel.imports) imports.add(`import ${imp};`);
    }
    // always include Jackson annotations used in fields
    imports.add('import com.fasterxml.jackson.annotation.JsonBackReference;');
    imports.add(
      'import com.fasterxml.jackson.annotation.JsonManagedReference;',
    );

    const importsArr = Array.from(imports);

    const body = `package com.example.demo.model;\n\n${importsArr.join('\n')}\n\n@Data\n@Entity\npublic class ${className} {\n${fields.join('\n\n')}\n\n${relFields.join('\n\n')}\n}`;
    return body;
  }
}
