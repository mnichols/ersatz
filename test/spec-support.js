var chai = require('chai')
    ,should = require('chai').should() //touch All The Things


chai.config.includeStack = true

global.expect = chai.expect
global.AssertionError = chai.AssertionError
global.Assertion = chai.Assertion
global.assert = chai.assert

