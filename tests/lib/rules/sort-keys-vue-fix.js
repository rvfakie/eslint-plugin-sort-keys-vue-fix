/**
 * @fileoverview Tests for sort-keys-fix rule.
 * @author Toru Nagashima
 */
 'use strict'

 // ------------------------------------------------------------------------------
 // Requirements
 // ------------------------------------------------------------------------------
 
 const path = require('path')
 const rule = require('../../../lib/rules/sort-keys-vue-fix')
 const RuleTester = require('eslint').RuleTester
 
 // ------------------------------------------------------------------------------
 // Tests
 // ------------------------------------------------------------------------------
 
 const test = {
   invalid: [
     // asc
     {
       code: 'var obj = {a:1, c:2, b:3}',
       options: ['asc'],
       errors: ["Expected object keys to be in ascending order. 'b' should be before 'c'."],
       output: 'var obj = {a:1, b:3, c:2}',
     }
   ],
 }
 
 const ruleTester = new RuleTester()
 
 ruleTester.run('sort-keys-vue-fix', rule, test)