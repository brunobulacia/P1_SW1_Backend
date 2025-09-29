//spring-generator.service.ts
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
    // base package path
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

    // si se especifica outputRoot, copiar skeleton demo/
    if (outputRoot) {
      const templateRoot = path.join(process.cwd(), 'demo');
      try {
        const pomSrc = path.join(templateRoot, 'pom.xml');
        if (fs.existsSync(pomSrc)) {
          this.ensureDir(outputRoot);
          fs.copyFileSync(pomSrc, path.join(outputRoot, 'pom.xml'));
        }

        const mvnw = path.join(templateRoot, 'mvnw');
        if (fs.existsSync(mvnw)) {
          fs.copyFileSync(mvnw, path.join(outputRoot, 'mvnw'));
          fs.chmodSync(path.join(outputRoot, 'mvnw'), 0o755);
        }
        const mvnwCmd = path.join(templateRoot, 'mvnw.cmd');
        if (fs.existsSync(mvnwCmd)) {
          fs.copyFileSync(mvnwCmd, path.join(outputRoot, 'mvnw.cmd'));
        }

        const mvnFolder = path.join(templateRoot, '.mvn');
        if (fs.existsSync(mvnFolder))
          this.copyRecursiveSync(mvnFolder, path.join(outputRoot, '.mvn'));

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
        console.warn('Warning copying template files:', err);
      }
    }

    // ensure dirs
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

    // maps
    const nodeIdToClass: Record<string, string> = {};
    const attributesMap: Record<string, ModelNodeAttr[]> = {};
    for (const node of nodes) {
      const className = this.sanitizeClassName(node.data.label);
      nodeIdToClass[node.id] = className;
      attributesMap[className] = node.data.attributes || [];
    }

    const relationsMap: Record<
      string,
      { fields: string[]; imports: Set<string>; relationshipCount: Record<string, number> }
    > = {};
    for (const node of nodes) {
      const className = nodeIdToClass[node.id];
      relationsMap[className] = { fields: [], imports: new Set(), relationshipCount: {} };
    }

    const isMany = (card?: string) => !!card && card.includes('*');

    for (const edge of edges) {
      const sourceClass = nodeIdToClass[edge.source];
      const targetClass = nodeIdToClass[edge.target];
      if (!sourceClass || !targetClass) continue;

      const sourceCard = edge.data?.sourceCardinality;
      const targetCard = edge.data?.targetCardinality;

      const sourceHasManyTargets = isMany(targetCard);
      const targetHasManySources = isMany(sourceCard);

      const sourceLower =
        sourceClass.charAt(0).toLowerCase() + sourceClass.slice(1);
      const targetLower =
        targetClass.charAt(0).toLowerCase() + targetClass.slice(1);

      if (sourceHasManyTargets && targetHasManySources) {
        // Many-to-Many (lado source propietario)
        relationsMap[sourceClass].imports.add('java.util.List');
        relationsMap[sourceClass].imports.add('jakarta.persistence.ManyToMany');
        relationsMap[sourceClass].imports.add('jakarta.persistence.JoinTable');
        relationsMap[sourceClass].imports.add('jakarta.persistence.JoinColumn');
        relationsMap[sourceClass].imports.add(
          'com.fasterxml.jackson.annotation.JsonManagedReference',
        );
        relationsMap[sourceClass].fields.push(
          `    @ManyToMany
    @JoinTable(name = "${sourceLower}_${targetLower}", joinColumns = @JoinColumn(name = "${sourceLower}_id"), inverseJoinColumns = @JoinColumn(name = "${targetLower}_id"))
    @JsonManagedReference("${sourceLower}")
    private List<${targetClass}> ${targetLower}s;`,
        );

        relationsMap[targetClass].imports.add('java.util.List');
        relationsMap[targetClass].imports.add('jakarta.persistence.ManyToMany');
        relationsMap[targetClass].imports.add(
          'com.fasterxml.jackson.annotation.JsonBackReference',
        );
        relationsMap[targetClass].fields.push(
          `    @ManyToMany(mappedBy = "${targetLower}s")
    @JsonBackReference("${targetLower}")
    private List<${sourceClass}> ${sourceLower}s;`,
        );
      } else if (sourceHasManyTargets) {
        // OneToMany (source) / ManyToOne (target)
        relationsMap[sourceClass].imports.add('java.util.List');
        relationsMap[sourceClass].imports.add('jakarta.persistence.OneToMany');
        relationsMap[sourceClass].imports.add(
          'com.fasterxml.jackson.annotation.JsonManagedReference',
        );
        
        // Contar relaciones para evitar conflictos de nombres
        const relationKey = `${sourceClass}-${targetClass}`;
        const count = relationsMap[sourceClass].relationshipCount[relationKey] || 0;
        relationsMap[sourceClass].relationshipCount[relationKey] = count + 1;
        
        relationsMap[sourceClass].fields.push(
          `    @OneToMany(mappedBy = "${sourceLower}")
    @JsonManagedReference("${sourceLower}")
    private List<${targetClass}> ${targetLower}s;`,
        );

        relationsMap[targetClass].imports.add('jakarta.persistence.ManyToOne');
        relationsMap[targetClass].imports.add('jakarta.persistence.JoinColumn');
        relationsMap[targetClass].imports.add(
          'com.fasterxml.jackson.annotation.JsonBackReference',
        );
        
        // Contar relaciones múltiples hacia la misma clase target
        const targetRelationKey = `${targetClass}-${sourceClass}`;
        const targetCount = relationsMap[targetClass].relationshipCount[targetRelationKey] || 0;
        relationsMap[targetClass].relationshipCount[targetRelationKey] = targetCount + 1;
        
        relationsMap[targetClass].fields.push(
          `    @ManyToOne
    @JoinColumn(name = "${sourceLower}_id")
    @JsonBackReference("${sourceLower}")
    private ${sourceClass} ${sourceLower};`,
        );
      } else if (targetHasManySources) {
        // OneToMany (target) / ManyToOne (source)
        relationsMap[targetClass].imports.add('java.util.List');
        relationsMap[targetClass].imports.add('jakarta.persistence.OneToMany');
        relationsMap[targetClass].imports.add(
          'com.fasterxml.jackson.annotation.JsonManagedReference',
        );
        
        // Contar relaciones para evitar conflicto
        const relationKey = `${targetClass}-${sourceClass}`;
        const count = relationsMap[targetClass].relationshipCount[relationKey] || 0;
        relationsMap[targetClass].relationshipCount[relationKey] = count + 1;
        
        relationsMap[targetClass].fields.push(
          `    @OneToMany(mappedBy = "${targetLower}")
    @JsonManagedReference("${targetLower}")
    private List<${sourceClass}> ${sourceLower}s;`,
        );

        relationsMap[sourceClass].imports.add('jakarta.persistence.ManyToOne');
        relationsMap[sourceClass].imports.add('jakarta.persistence.JoinColumn');
        relationsMap[sourceClass].imports.add(
          'com.fasterxml.jackson.annotation.JsonBackReference',
        );
        
        // Contar relaciones múltiples hacia la misma clase source
        const sourceRelationKey = `${sourceClass}-${targetClass}`;
        const sourceCount = relationsMap[sourceClass].relationshipCount[sourceRelationKey] || 0;
        relationsMap[sourceClass].relationshipCount[sourceRelationKey] = sourceCount + 1;
        
        relationsMap[sourceClass].fields.push(
          `    @ManyToOne
    @JoinColumn(name = "${targetLower}_id")
    @JsonBackReference("${targetLower}")
    private ${targetClass} ${targetLower};`,
        );
      } else {
        // One-to-One
        relationsMap[sourceClass].imports.add('jakarta.persistence.OneToOne');
        relationsMap[sourceClass].imports.add('jakarta.persistence.JoinColumn');
        relationsMap[sourceClass].imports.add(
          'com.fasterxml.jackson.annotation.JsonManagedReference',
        );
        relationsMap[sourceClass].fields.push(
          `    @OneToOne
    @JoinColumn(name = "${targetLower}_id")
    @JsonManagedReference("${sourceLower}")
    private ${targetClass} ${targetLower};`,
        );

        relationsMap[targetClass].imports.add('jakarta.persistence.OneToOne');
        relationsMap[targetClass].imports.add(
          'com.fasterxml.jackson.annotation.JsonBackReference',
        );
        relationsMap[targetClass].fields.push(
          `    @OneToOne(mappedBy = "${targetLower}")
    @JsonBackReference("${targetLower}")
    private ${sourceClass} ${sourceLower};`,
        );
      }
    }

    // generar archivos
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

      const ctrl = this.buildController(className); // <— con produces/consumes
      fs.writeFileSync(
        path.join(controllerDir, `${className}Controller.java`),
        ctrl,
        'utf8',
      );
    }
  }

  private ensureDir(dir: string) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

  private buildRepository(className: string) {
    return `package com.example.demo.repository;

import com.example.demo.model.${className};
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ${className}Repository extends JpaRepository<${className}, Long> {
}
`;
  }

  private buildService(className: string) {
    return `package com.example.demo.service;

import com.example.demo.model.${className};
import com.example.demo.repository.${className}Repository;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class ${className}Service {
    private final ${className}Repository repository;

    public ${className}Service(${className}Repository repository) {
        this.repository = repository;
    }

    public List<${className}> findAll() {
        return repository.findAll();
    }

    public Optional<${className}> findById(Long id) {
        return repository.findById(id);
    }

    public ${className} create(${className} entity) {
        return repository.save(entity);
    }

    public ${className} update(Long id, ${className} entity) {
        entity.setId(id);
        return repository.save(entity);
    }

    public void delete(Long id) {
        repository.deleteById(id);
    }
}
`;
  }

  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  // CAMBIO IMPORTANTE: controller con produces/consumes explícitos
  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  private buildController(className: string) {
    const lower = className.charAt(0).toLowerCase() + className.slice(1);
    return `package com.example.demo.controller;

import com.example.demo.model.${className};
import com.example.demo.service.${className}Service;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/${lower}")
public class ${className}Controller {
    private final ${className}Service service;

    public ${className}Controller(${className}Service service) {
        this.service = service;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public List<${className}> all() {
        return service.findAll();
    }

    @GetMapping(path = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<${className}> get(@PathVariable Long id) {
        return service.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ${className} create(@RequestBody ${className} entity) {
        return service.create(entity);
    }

    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ${className} update(@PathVariable Long id, @RequestBody ${className} entity) {
        return service.update(id, entity);
    }

    @DeleteMapping(path = "/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
`;
  }

  private buildEntityWithRelations(
    className: string,
    attributes: ModelNodeAttr[],
    rel: { fields: string[]; imports: Set<string> } | undefined,
  ) {
    const fields: string[] = [];

    // id
    const hasId = attributes?.some((a) => a.name === 'id');
    if (!hasId) {
      fields.push(
        `    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;`,
      );
    } else {
      fields.push(
        `    @Id
    private Long id;`,
      );
    }

    // atributos simples
    for (const attr of attributes) {
      if (attr.name === 'id') continue;
      const t = this.mapType(attr.type);
      fields.push(`    private ${t} ${attr.name};`);
    }

    // relaciones
    const relFields = rel?.fields || [];

    // imports
    const imports = new Set<string>([
      'import jakarta.persistence.*;',
      'import lombok.Data;',
      'import com.fasterxml.jackson.annotation.JsonBackReference;',
      'import com.fasterxml.jackson.annotation.JsonManagedReference;',
    ]);
    if (rel?.imports) {
      for (const imp of rel.imports) imports.add(`import ${imp};`);
    }

    // ⬇️⮕ AQUÍ construimos el body con @NoArgsConstructor y @AllArgsConstructor
    const body = `package com.example.demo.model;

${Array.from(imports).join('\n')}
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
public class ${className} {
${fields.join('\n\n')}

${relFields.join('\n\n')}
}`;

    return body;
  }
  // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
}
