/**
 * @fileoverview enforce sort-keys in a manner that is compatible with order-in-components
 * @author Roman Volchkov
 * eslint-plugin-vue sort-keys by Loren Klingman
 * eslint-plugin-sort-keys by Nam Nguyen
 * Original ESLint sort-keys by Toru Nagashima
 */
 'use strict'

 // ------------------------------------------------------------------------------
 // Requirements
 // ------------------------------------------------------------------------------
 
 const naturalCompare = require('natural-compare')
 const utils = require('../utils')
 
 // ------------------------------------------------------------------------------
 // Helpers
 // ------------------------------------------------------------------------------
 
 /**
  * Gets the property name of the given `Property` node.
  *
  * - If the property's key is an `Identifier` node, this returns the key's name
  *   whether it's a computed property or not.
  * - If the property has a static name, this returns the static name.
  * - Otherwise, this returns null.
  * @param {ASTNode} node The `Property` node to get.
  * @returns {string|null} The property name or null.
  * @private
  */
 function getPropertyName(node) {
   const staticName = utils.getStaticPropertyName(node)
 
   if (staticName !== null) {
     return staticName
   }
 
   return node.key.name || null
 }
 
 /**
  * Functions which check that the given 2 names are in specific order.
  *
  * Postfix `I` is meant insensitive.
  * Postfix `N` is meant natual.
  * @private
  */
 const isValidOrders = {
   asc(a, b) {
     return a <= b
   },
   ascI(a, b) {
     return a.toLowerCase() <= b.toLowerCase()
   },
   ascN(a, b) {
     return naturalCompare(a, b) <= 0
   },
   ascIN(a, b) {
     return naturalCompare(a.toLowerCase(), b.toLowerCase()) <= 0
   },
   desc(a, b) {
     return isValidOrders.asc(b, a)
   },
   descI(a, b) {
     return isValidOrders.ascI(b, a)
   },
   descN(a, b) {
     return isValidOrders.ascN(b, a)
   },
   descIN(a, b) {
     return isValidOrders.ascIN(b, a)
   }
 }
 
 // ------------------------------------------------------------------------------
 // Rule Definition
 // ------------------------------------------------------------------------------
 
 module.exports = {
   meta: {
     type: 'suggestion',
     docs: {
       description: 'enforce sort-keys in a manner that is compatible with order-in-components',
       category: null,
       recommended: false,
       url: 'https://eslint.vuejs.org/rules/sort-keys.html'
     },
     fixable: 'code',
     schema: [{
         enum: ['asc', 'desc']
       },
       {
         type: 'object',
         properties: {
           caseSensitive: {
             type: 'boolean',
             default: true
           },
           ignoreChildrenOf: {
             type: 'array'
           },
           ignoreGrandchildrenOf: {
             type: 'array'
           },
           minKeys: {
             type: 'integer',
             minimum: 2,
             default: 2
           },
           natural: {
             type: 'boolean',
             default: false
           },
           runOutsideVue: {
             type: 'boolean',
             default: true
           }
         },
         additionalProperties: false
       }
     ]
   },
 
   create(context) {
     // Parse options.
     const options = context.options[1]
     const order = context.options[0] || 'asc'
 
     const ignoreGrandchildrenOf = (options && options.ignoreGrandchildrenOf) || ['computed', 'directives', 'inject', 'props', 'watch']
     const ignoreChildrenOf = (options && options.ignoreChildrenOf) || ['model']
     const insensitive = options && options.caseSensitive === false
     const minKeys = options && options.minKeys
     const natual = options && options.natural
     const isValidOrder = isValidOrders[
       order + (insensitive ? 'I' : '') + (natual ? 'N' : '')
     ]
 
     // The stack to save the previous property's name for each object literals.
     let stack = null
 
     let errors = []
     const names = {}
 
     const reportErrors = (isVue) => {
       if (isVue) {
         errors = errors.filter((error) => {
           let parentIsRoot = !error.hasUpper
           let grandParentIsRoot = !error.grandparent
           let greatGrandparentIsRoot = !error.greatGrandparent
 
           const stackPrevChar = stack && stack.prevChar
           if (stackPrevChar) {
             parentIsRoot = stackPrevChar === error.parent
             grandParentIsRoot = stackPrevChar === error.grandparent
             greatGrandparentIsRoot = stackPrevChar === error.greatGrandparent
           }
 
           if (parentIsRoot) {
             return false
           } else if (grandParentIsRoot) {
             return !error.parentIsProperty || !ignoreChildrenOf.includes(names[error.parent])
           } else if (greatGrandparentIsRoot) {
             return !error.parentIsProperty || !ignoreGrandchildrenOf.includes(names[error.grandparent])
           }
           return true
         })
       }
       errors.forEach((error) => error.errors.forEach((e) => {
         return context.report({
           ...e,
           fix(fixer) {
             // Check if already sorted
             if (
               e.node.parent.__alreadySorted ||
               e.node.parent.properties.__alreadySorted
             ) {
               return []
             }
             e.node.parent.__alreadySorted = true
             e.node.parent.properties.__alreadySorted = true
             //
             const src = context.getSourceCode()
             const props = e.node.parent.properties
             // Split into parts on each spread operator (empty key)
             const parts = []
             let part = []
             props.forEach(p => {
               if (!p.key) {
                 parts.push(part)
                 part = []
               } else {
                 part.push(p)
               }
             })
             parts.push(part)
             // Sort all parts
             parts.forEach(part => {
               part.sort((p1, p2) => {
                 const n1 = getPropertyName(p1)
                 const n2 = getPropertyName(p2)
                 if (insensitive && n1.toLowerCase() === n2.toLowerCase()) {
                   return 0
                 }
                 return isValidOrder(n1, n2) ? -1 : 1
               })
             })
             // Perform fixes
             const fixes = []
             let newIndex = 0
             parts.forEach(part => {
               part.forEach(p => {
                 moveProperty(p, props[newIndex], fixer, src).forEach(f =>
                   fixes.push(f),
                 )
                 newIndex++
               })
               newIndex++
             })
             return fixes
           },
         })
       }))
       errors = []
     }
 
     const moveProperty = (thisNode, toNode, fixer, src) => {
       if (thisNode === toNode) {
         return []
       }
       const fixes = []
       // Move property
       fixes.push(fixer.replaceText(toNode, src.getText(thisNode)))
       // Move comments on top of this property, but do not move comments
       //    on the same line with the previous property
       const prev = findTokenPrevLine(thisNode, src)
       const cond = c => !prev || prev.loc.end.line !== c.loc.start.line
       const commentsBefore = src.getCommentsBefore(thisNode).filter(cond)
       if (commentsBefore.length) {
         const prevComments = src.getCommentsBefore(thisNode).filter(c => !cond(c))
         const b = prevComments.length ?
           prevComments[prevComments.length - 1].range[1] :
           prev ?
           prev.range[1] :
           commentsBefore[0].range[0]
         const e = commentsBefore[commentsBefore.length - 1].range[1]
         fixes.push(fixer.replaceTextRange([b, e], ''))
         const toPrev = src.getTokenBefore(toNode, {
           includeComments: true
         })
         const txt = src.text.substring(b, e)
         fixes.push(fixer.insertTextAfter(toPrev, txt))
       }
       // Move comments on the same line with this property
       const next = findCommaSameLine(thisNode, src) || thisNode
       const commentsAfter = src
         .getCommentsAfter(next)
         .filter(c => thisNode.loc.end.line === c.loc.start.line)
       if (commentsAfter.length) {
         const b = next.range[1]
         const e = commentsAfter[commentsAfter.length - 1].range[1]
         fixes.push(fixer.replaceTextRange([b, e], ''))
         const toNext = findCommaSameLine(toNode, src) || toNode
         const txt = src.text.substring(b, e)
         fixes.push(fixer.insertTextAfter(toNext, txt))
       }
       return fixes
     }
     const findTokenPrevLine = (node, src) => {
       let t = src.getTokenBefore(node)
       while (true) {
         if (!t || t.range[0] < node.parent.range[0]) {
           return null
         }
         if (t.loc.end.line < node.loc.start.line) {
           return t
         }
         t = src.getTokenBefore(t)
       }
     }
     const findCommaSameLine = (node, src) => {
       const t = src.getTokenAfter(node)
       return t && t.value === ',' && node.loc.end.line === t.loc.start.line ?
         t :
         null
     }
 
     const sortTests = {
       ObjectExpression(node) {
         if (!stack) {
           reportErrors(false)
         }
         stack = {
           upper: stack,
           prevChar: null,
           prevName: null,
           numKeys: node.properties.length,
           parentIsProperty: node.parent.type === 'Property',
           errors: []
         }
       },
       'ObjectExpression:exit'(node) {
         errors.push({
           errors: stack.errors,
           hasUpper: !!stack.upper,
           parentIsProperty: node.parent.type === 'Property',
           parent: stack.upper && stack.upper.prevChar,
           grandparent: stack.upper && stack.upper.upper && stack.upper.upper.prevChar,
           greatGrandparent: stack.upper && stack.upper.upper && stack.upper.upper.upper && stack.upper.upper.upper.prevChar
         })
         stack = stack.upper
       },
       SpreadElement(node) {
         if (node.parent.type === 'ObjectExpression') {
           stack.prevName = null
           stack.prevChar = null
         }
       },
       'Program:exit'() {
         reportErrors(false)
       },
       Property(node) {
         if (node.parent.type === 'ObjectPattern') {
           return
         }
 
         const prevName = stack.prevName
         const numKeys = stack.numKeys
         const thisName = getPropertyName(node)
 
         if (thisName !== null) {
           stack.prevName = thisName
           stack.prevChar = node.range[0]
           if (Object.prototype.hasOwnProperty.call(names, node.range[0])) {
             throw new Error('Name clash')
           }
           names[node.range[0]] = thisName
         }
 
         if (prevName === null || thisName === null || numKeys < minKeys) {
           return
         }
 
         if (!isValidOrder(prevName, thisName)) {
           stack.errors.push({
             node,
             loc: node.key.loc,
             message: "Expected object keys to be in {{natual}}{{insensitive}}{{order}}ending order. '{{thisName}}' should be before '{{prevName}}'.",
             data: {
               thisName,
               prevName,
               order,
               insensitive: insensitive ? 'insensitive ' : '',
               natual: natual ? 'natural ' : ''
             }
           })
         }
       }
     }
 
     const execOnVue = utils.executeOnVue(context, () => {
       reportErrors(true)
     })
 
     const result = {
       ...sortTests
     }
 
     Object.keys(execOnVue).forEach((key) => {
       // Ensure we call both the callback from sortTests and execOnVue if they both use the same key
       if (Object.prototype.hasOwnProperty.call(sortTests, key)) {
         result[key] = (node) => {
           sortTests[key](node)
           execOnVue[key](node)
         }
       } else {
         result[key] = execOnVue[key]
       }
     })
 
     return result
   }
 }