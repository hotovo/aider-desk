(function_signature
  name: (identifier) @name.definition.function) @definition.function

(method_signature
  name: (property_identifier) @name.definition.method) @definition.method

(abstract_method_signature
  name: (property_identifier) @name.definition.method) @definition.method

(abstract_class_declaration
  name: (type_identifier) @name.definition.class) @definition.class

(module
  name: (identifier) @name.definition.module) @definition.module

(interface_declaration
  name: (type_identifier) @name.definition.interface) @definition.interface

(type_annotation
  (type_identifier) @name.reference.type) @reference.type

(new_expression
  constructor: (identifier) @name.reference.class) @reference.class

(function_declaration
  name: (identifier) @name.definition.function) @definition.function

(method_definition
  name: (property_identifier) @name.definition.method) @definition.method

(class_declaration
  name: (type_identifier) @name.definition.class) @definition.class

(interface_declaration
  name: (type_identifier) @name.definition.class) @definition.class

(type_alias_declaration
  name: (type_identifier) @name.definition.type) @definition.type

(enum_declaration
  name: (identifier) @name.definition.enum) @definition.enum

; Interface and type properties
(interface_declaration
  body: (interface_body
    (property_signature
      name: (property_identifier) @name.definition.property))) @definition.property

(type_alias_declaration
  value: (object_type
    (property_signature
      name: (property_identifier) @name.definition.property))) @definition.property

; Variables (const, let, var)
(lexical_declaration
  (variable_declarator
    name: (identifier) @name.definition.variable)) @definition.variable

(variable_declaration
  (variable_declarator
    name: (identifier) @name.definition.variable)) @definition.variable
