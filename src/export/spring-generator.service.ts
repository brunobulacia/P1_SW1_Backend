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
    associationClass?: string;
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
      {
        fields: string[];
        imports: Set<string>;
        relationshipCount: Record<string, number>;
        compositionChild?: {
          idClassName: string;
          parentClass: string;
          parentLower: string;
          childIdJavaType: string;
        };
        inheritance?: {
          isParent: boolean;
          isChild: boolean;
          parentClass?: string;
          discriminatorValue?: string;
        };
      }
    > = {};
    for (const node of nodes) {
      const className = nodeIdToClass[node.id];
      relationsMap[className] = {
        fields: [],
        imports: new Set(),
        relationshipCount: {},
      };
    }

    const isMany = (card?: string) => !!card && card.includes('*');

    // Mapa de herencia: padre → hijos y hijo → padre
    const parentToChildren: Record<string, string[]> = {};
    const childToParent: Record<string, string> = {};
    for (const edge of edges) {
      const isInheritance =
        edge.data?.type === 'inheritance' || edge.type === 'inheritance';
      if (!isInheritance) continue;
      const parentClass = nodeIdToClass[edge.source];
      const childClass = nodeIdToClass[edge.target];
      if (!parentClass || !childClass) continue;
      parentToChildren[parentClass] = parentToChildren[parentClass] || [];
      parentToChildren[parentClass].push(childClass);
      childToParent[childClass] = parentClass;
    }

    // Marcar metadata de herencia en relationsMap
    for (const className of Object.keys(relationsMap)) {
      const isParent = !!parentToChildren[className]?.length;
      const parentClass = childToParent[className];
      const isChild = !!parentClass;
      if (isParent || isChild) {
        const discriminatorValue = isChild
          ? className.charAt(0).toUpperCase()
          : undefined;
        relationsMap[className].inheritance = {
          isParent,
          isChild,
          parentClass,
          discriminatorValue,
        };
      }
    }

    // Para clases/id embebidos generados por composición
    const extraModelFiles: { name: string; content: string }[] = [];

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

      // Ignorar edges de herencia en el procesamiento de relaciones
      if (edge.data?.type === 'inheritance' || edge.type === 'inheritance') {
        continue;
      }

      // COMPOSITION: source (agregado) → target (parte) con PK compuesta
      if (edge.data?.type === 'composition') {
        // Lado padre/agregado
        relationsMap[sourceClass].imports.add('java.util.List');
        relationsMap[sourceClass].imports.add('jakarta.persistence.OneToMany');
        relationsMap[sourceClass].imports.add(
          'jakarta.persistence.CascadeType',
        );
        relationsMap[sourceClass].imports.add(
          'com.fasterxml.jackson.annotation.JsonManagedReference',
        );
        relationsMap[sourceClass].fields.push(
          `    @OneToMany(mappedBy = "${sourceLower}", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference("${sourceLower}_composition")
    private List<${targetClass}> ${targetLower}s;`,
        );

        // ID compuesto en el hijo: <Target>Id { <parent>Id, id }
        const childAttrs = attributesMap[targetClass] || [];
        const childIdAttr = childAttrs.find((a) => a.name === 'id');
        const childIdJavaType = this.mapType(childIdAttr?.type || 'Long');
        const idClassName = `${targetClass}Id`;

        relationsMap[targetClass].compositionChild = {
          idClassName,
          parentClass: sourceClass,
          parentLower: sourceLower,
          childIdJavaType,
        };

        const idClass = `package com.example.demo.model;

import jakarta.persistence.Embeddable;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.io.Serializable;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Embeddable
public class ${idClassName} implements Serializable {
    private Long ${sourceLower}Id;
    private ${childIdJavaType} id;
}`;
        extraModelFiles.push({ name: `${idClassName}.java`, content: idClass });

        relationsMap[targetClass].imports.add('jakarta.persistence.ManyToOne');
        relationsMap[targetClass].imports.add('jakarta.persistence.JoinColumn');
        relationsMap[targetClass].imports.add('jakarta.persistence.MapsId');
        relationsMap[targetClass].imports.add('jakarta.persistence.EmbeddedId');
        relationsMap[targetClass].imports.add(
          'com.fasterxml.jackson.annotation.JsonBackReference',
        );
        relationsMap[targetClass].fields.push(
          `    @EmbeddedId
    private ${idClassName} id;`,
        );
        relationsMap[targetClass].fields.push(
          `    @ManyToOne(optional = false)
    @MapsId("${sourceLower}Id")
    @JoinColumn(name = "${sourceLower}_id")
    @JsonBackReference("${sourceLower}_composition")
    private ${sourceClass} ${sourceLower};`,
        );

        continue;
      }

      // Caso especial: Asociación con Clase de Asociación (join entity)
      // Si el edge declara una associationClass, generamos una entidad intermedia
      // con dos @ManyToOne y en los extremos usamos @OneToMany(mappedBy=...)
      const associationClassNodeId = edge.data?.associationClass;
      if (
        edge.data?.type === 'association' &&
        associationClassNodeId &&
        nodeIdToClass[associationClassNodeId]
      ) {
        const assocClass = nodeIdToClass[associationClassNodeId];
        const assocLower =
          assocClass.charAt(0).toLowerCase() + assocClass.slice(1);

        // Lado fuente: OneToMany a la clase de asociación
        relationsMap[sourceClass].imports.add('java.util.List');
        relationsMap[sourceClass].imports.add('jakarta.persistence.OneToMany');
        relationsMap[sourceClass].imports.add(
          'com.fasterxml.jackson.annotation.JsonManagedReference',
        );
        relationsMap[sourceClass].fields.push(
          `    @OneToMany(mappedBy = "${sourceLower}")
    @JsonManagedReference("${sourceLower}_${assocLower}")
    private List<${assocClass}> ${assocLower}s;`,
        );

        // Lado target: OneToMany a la clase de asociación
        relationsMap[targetClass].imports.add('java.util.List');
        relationsMap[targetClass].imports.add('jakarta.persistence.OneToMany');
        relationsMap[targetClass].imports.add(
          'com.fasterxml.jackson.annotation.JsonManagedReference',
        );
        relationsMap[targetClass].fields.push(
          `    @OneToMany(mappedBy = "${targetLower}")
    @JsonManagedReference("${targetLower}_${assocLower}")
    private List<${assocClass}> ${assocLower}s;`,
        );

        // Clase de asociación: dos ManyToOne (hacia source y target)
        relationsMap[assocClass].imports.add('jakarta.persistence.ManyToOne');
        relationsMap[assocClass].imports.add('jakarta.persistence.JoinColumn');
        relationsMap[assocClass].imports.add(
          'com.fasterxml.jackson.annotation.JsonBackReference',
        );

        relationsMap[assocClass].fields.push(
          `    @ManyToOne
    @JoinColumn(name = "${sourceLower}_id")
    @JsonBackReference("${sourceLower}_${assocLower}")
    private ${sourceClass} ${sourceLower};`,
        );

        relationsMap[assocClass].fields.push(
          `    @ManyToOne
    @JoinColumn(name = "${targetLower}_id")
    @JsonBackReference("${targetLower}")
    private ${targetClass} ${targetLower};`,
        );

        // Ya manejado como join-entity, continuar al próximo edge
        continue;
      }

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
        const count =
          relationsMap[sourceClass].relationshipCount[relationKey] || 0;
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
        const targetCount =
          relationsMap[targetClass].relationshipCount[targetRelationKey] || 0;
        relationsMap[targetClass].relationshipCount[targetRelationKey] =
          targetCount + 1;

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
        const count =
          relationsMap[targetClass].relationshipCount[relationKey] || 0;
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
        const sourceCount =
          relationsMap[sourceClass].relationshipCount[sourceRelationKey] || 0;
        relationsMap[sourceClass].relationshipCount[sourceRelationKey] =
          sourceCount + 1;

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
    @JsonManagedReference("${sourceLower}_${targetLower}")
    private ${targetClass} ${targetLower};`,
        );

        relationsMap[targetClass].imports.add('jakarta.persistence.OneToOne');
        relationsMap[targetClass].imports.add(
          'com.fasterxml.jackson.annotation.JsonBackReference',
        );
        relationsMap[targetClass].fields.push(
          `    @OneToOne(mappedBy = "${targetLower}")
    @JsonBackReference("${sourceLower}_${targetLower}")
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

      const ctrl = this.buildController(
        className,
        rel?.inheritance?.isChild,
        rel?.inheritance?.parentClass,
      ); // <— con produces/consumes
      fs.writeFileSync(
        path.join(controllerDir, `${className}Controller.java`),
        ctrl,
        'utf8',
      );
    }

    // escribir modelos auxiliares (Ids embebidos)
    for (const f of extraModelFiles) {
      fs.writeFileSync(path.join(modelDir, f.name), f.content, 'utf8');
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
  private buildController(
    className: string,
    isInheritanceChild?: boolean,
    parentClass?: string,
  ) {
    const lower = className.charAt(0).toLowerCase() + className.slice(1);
    const baseController = `package com.example.demo.controller;

import com.example.demo.model.${className};
import com.example.demo.service.${className}Service;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.stream.Collectors;

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
}`;

    // Si es clase hija, agregar endpoints específicos que filtren por tipo
    if (isInheritanceChild && parentClass) {
      // Remover la última llave de cierre de la clase
      const baseControllerWithoutClosing = baseController.replace(/\}\s*$/, '');

      return (
        baseControllerWithoutClosing +
        `

    // Endpoints específicos para ${className} (filtrados por tipo)
    @GetMapping(path = "/${lower}s", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<${className}> all${className}s() {
        return service.findAll().stream()
                .filter(v -> v instanceof ${className})
                .map(v -> (${className}) v)
                .collect(Collectors.toList());
    }

    @GetMapping(path = "/${lower}s/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<${className}> get${className}(@PathVariable Long id) {
        return service.findById(id)
                .filter(v -> v instanceof ${className})
                .map(v -> (${className}) v)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
`
      );
    }

    return baseController;
  }

  private buildEntityWithRelations(
    className: string,
    attributes: ModelNodeAttr[],
    rel:
      | {
          fields: string[];
          imports: Set<string>;
          inheritance?: {
            isParent: boolean;
            isChild: boolean;
            parentClass?: string;
            discriminatorValue?: string;
          };
          compositionChild?: {
            idClassName: string;
            parentClass: string;
            parentLower: string;
            childIdJavaType: string;
          };
        }
      | undefined,
  ) {
    const fields: string[] = [];

    // id: si es hijo en herencia JOINED, NO declarar id aquí (usa PK del padre)
    const isInheritanceChild = !!rel?.inheritance?.isChild;
    if (!isInheritanceChild) {
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
    // Importes adicionales para herencia
    if (rel?.inheritance?.isParent) {
      imports.add('import jakarta.persistence.Inheritance;');
      imports.add('import jakarta.persistence.InheritanceType;');
      imports.add('import jakarta.persistence.DiscriminatorColumn;');
      imports.add('import jakarta.persistence.DiscriminatorType;');
      imports.add('import jakarta.persistence.DiscriminatorValue;');
    }
    if (rel?.inheritance?.isChild) {
      imports.add('import jakarta.persistence.DiscriminatorValue;');
      imports.add('import jakarta.persistence.PrimaryKeyJoinColumn;');
    }
    if (rel?.imports) {
      for (const imp of rel.imports) imports.add(`import ${imp};`);
    }

    // ⬇️⮕ AQUÍ construimos el body con @NoArgsConstructor y @AllArgsConstructor
    // Anotaciones de herencia a nivel de clase
    const classAnnotations: string[] = [];
    if (rel?.inheritance?.isParent) {
      classAnnotations.push(
        '@Inheritance(strategy = InheritanceType.JOINED)',
        '@DiscriminatorColumn(name = "tipoHijo", discriminatorType = DiscriminatorType.STRING, length = 1)',
      );
      // Valor por defecto cuando se persiste el padre (H2 exige un char(1))
      const dvParent = className.charAt(0).toUpperCase();
      classAnnotations.push(`@DiscriminatorValue("${dvParent}")`);
    }
    if (rel?.inheritance?.isChild && rel.inheritance.parentClass) {
      const dv =
        rel.inheritance.discriminatorValue || className.charAt(0).toUpperCase();
      classAnnotations.push(
        `@DiscriminatorValue("${dv}")`,
        '@PrimaryKeyJoinColumn(name = "id")',
      );
    }

    const extendsClause =
      rel?.inheritance?.isChild && rel.inheritance?.parentClass
        ? ` extends ${rel.inheritance.parentClass}`
        : '';

    const body = `package com.example.demo.model;

${Array.from(imports).join('\n')}
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
${classAnnotations.join('\n')}
public class ${className}${extendsClause} {
${fields.join('\n\n')}

${relFields.join('\n\n')}
}`;

    return body;
  }
  // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
}
