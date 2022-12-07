/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
 'use strict'

 /**
  * @typedef {import('vue-eslint-parser').AST.ESLintArrayExpression} ArrayExpression
  * @typedef {import('vue-eslint-parser').AST.ESLintExpression} Expression
  * @typedef {import('vue-eslint-parser').AST.ESLintIdentifier} Identifier
  * @typedef {import('vue-eslint-parser').AST.ESLintLiteral} Literal
  * @typedef {import('vue-eslint-parser').AST.ESLintMemberExpression} MemberExpression
  * @typedef {import('vue-eslint-parser').AST.ESLintMethodDefinition} MethodDefinition
  * @typedef {import('vue-eslint-parser').AST.ESLintObjectExpression} ObjectExpression
  * @typedef {import('vue-eslint-parser').AST.ESLintProperty} Property
  * @typedef {import('vue-eslint-parser').AST.ESLintTemplateLiteral} TemplateLiteral
  */
 
 /**
  * @typedef { {key: Literal | null, value: null, node: ArrayExpression['elements'][0], propName: string} } ComponentArrayProp
  * @typedef { {key: Property['key'], value: Property['value'], node: Property, propName: string} } ComponentObjectProp
  */
 
 // ------------------------------------------------------------------------------
 // Exports
 // ------------------------------------------------------------------------------
 
 module.exports = { 
   /**
    * Gets the property name of a given node.
    * @param {Property|MethodDefinition|MemberExpression|Literal|TemplateLiteral|Identifier} node - The node to get.
    * @return {string|null} The property name if static. Otherwise, null.
    */
   getStaticPropertyName (node) {
     let prop
     switch (node && node.type) {
       case 'Property':
       case 'MethodDefinition':
         prop = node.key
         break
       case 'MemberExpression':
         prop = node.property
         break
       case 'Literal':
       case 'TemplateLiteral':
       case 'Identifier':
         prop = node
         break
       // no default
     }
 
     switch (prop && prop.type) {
       case 'Literal':
         return String(prop.value)
       case 'TemplateLiteral':
         if (prop.expressions.length === 0 && prop.quasis.length === 1) {
           return prop.quasis[0].value.cooked
         }
         break
       case 'Identifier':
         if (!node.computed) {
           return prop.name
         }
         break
       // no default
     }
 
     return null
   },

   isVueFile (path) {
    return path.endsWith('.vue') || path.endsWith('.jsx')
  },

  /**
   * Check whether the given node is a Vue component based
   * on the filename and default export type
   * export default {} in .vue || .jsx
   * @param {ASTNode} node Node to check
   * @param {string} path File name with extension
   * @returns {boolean}
   */
  isVueComponentFile (node, path) {
    return this.isVueFile(path) &&
      node.type === 'ExportDefaultDeclaration' &&
      node.declaration.type === 'ObjectExpression'
  },

  /**
   * Check whether given node is Vue component
   * Vue.component('xxx', {}) || component('xxx', {})
   * @param {ASTNode} node Node to check
   * @returns {boolean}
   */
  isVueComponent (node) {
    if (node.type === 'CallExpression') {
      const callee = node.callee

      if (callee.type === 'MemberExpression') {
        const calleeObject = this.unwrapTypes(callee.object)

        const isFullVueComponent = calleeObject.type === 'Identifier' &&
          calleeObject.name === 'Vue' &&
          callee.property.type === 'Identifier' &&
          ['component', 'mixin', 'extend'].indexOf(callee.property.name) > -1 &&
          node.arguments.length >= 1 &&
          node.arguments.slice(-1)[0].type === 'ObjectExpression'

        return isFullVueComponent
      }

      if (callee.type === 'Identifier') {
        const isDestructedVueComponent = callee.name === 'component' &&
          node.arguments.length >= 1 &&
          node.arguments.slice(-1)[0].type === 'ObjectExpression'

        return isDestructedVueComponent
      }
    }

    return false
  },

  /**
   * Check whether given node is new Vue instance
   * new Vue({})
   * @param {ASTNode} node Node to check
   * @returns {boolean}
   */
  isVueInstance (node) {
    const callee = node.callee
    return node.type === 'NewExpression' &&
      callee.type === 'Identifier' &&
      callee.name === 'Vue' &&
      node.arguments.length &&
      node.arguments[0].type === 'ObjectExpression'
  },
 
   /**
    * Check if current file is a Vue instance or component and call callback
    * @param {RuleContext} context The ESLint rule context object.
    * @param {Function} cb Callback function
    */
   executeOnVue (context, cb) {
     return Object.assign(
       this.executeOnVueComponent(context, cb),
       this.executeOnVueInstance(context, cb)
     )
   },

   /**
   * Check if current file is a Vue instance (new Vue) and call callback
   * @param {RuleContext} context The ESLint rule context object.
   * @param {Function} cb Callback function
   */
   executeOnVueInstance (context, cb) {
    const _this = this

    return {
     'NewExpression:exit' (node) {
       // new Vue({})
       if (!_this.isVueInstance(node)) return
       cb(node.arguments[0])
      }
    }
   },

   /**
   * Check if current file is a Vue component and call callback
   * @param {RuleContext} context The ESLint rule context object.
   * @param {Function} cb Callback function
   */
   executeOnVueComponent (context, cb) {
    const filePath = context.getFilename()
    const sourceCode = context.getSourceCode()
    const _this = this
    const componentComments = sourceCode.getAllComments().filter(comment => /@vue\/component/g.test(comment.value))
    const foundNodes = []

    const isDuplicateNode = (node) => {
     if (foundNodes.some(el => el.loc.start.line === node.loc.start.line)) return true
     foundNodes.push(node)
     return false
    }

    return {
     'ObjectExpression:exit' (node) {
       if (!componentComments.some(el => el.loc.end.line === node.loc.start.line - 1) || isDuplicateNode(node)) return
       cb(node)
      },
      'ExportDefaultDeclaration:exit' (node) {
       // export default {} in .vue || .jsx
       if (!_this.isVueComponentFile(node, filePath) || isDuplicateNode(node.declaration)) return
       cb(node.declaration)
      },
      'CallExpression:exit' (node) {
       // Vue.component('xxx', {}) || component('xxx', {})
       if (!_this.isVueComponent(node) || isDuplicateNode(node.arguments.slice(-1)[0])) return
       cb(node.arguments.slice(-1)[0])
      }
    }
   },

   /**
   * Unwrap typescript types like "X as F"
   * @template T
   * @param {T} node
   * @return {T}
   */
  unwrapTypes (node) {
    return node.type === 'TSAsExpression' ? node.expression : node
  }
 }
 