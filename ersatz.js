'use strict';

var util = require('util')
    ,deepEqual = require('deep-equal')
    ,querystring = require('querystring')
    ,url = require('url')
;

module.exports = Ersatz

function Expectation(req, res) {
    this.req = req
    this.res = res
    this.requestCount = 0
    if(!this.req.url) {
        throw new Error('url is required for expectation')
    }
    if(!this.req.method) {
        throw new Error('method is required for expectation')
    }
}
Expectation.prototype.mark = function() {
    this.requestCount++
}
Expectation.prototype.match = function(req) {
    var matchers = [
        this.matchUrl
        ,this.matchParams
            ,this.matchMethod
            ,this.matchHeaders
            ,this.matchBody
    ]
    var errs = matchers.map(function(m){
            return m.call(this,req)
        },this)
        .filter(function(err){
            return (err instanceof Error)
        })
        .map(function(err){
            return err.message
        })

    return (errs.length ? new Error(errs.join('\n')) : undefined)
}
Expectation.prototype.fails = function(req) {
    var err  = this.match(req)
    return err
}
Expectation.prototype.matchUrl = function(req) {
    var msg = 'Expected request for %s, but got %s'
    var expectUrl = url.parse(this.req.url)
        ,actualUrl = url.parse(req.url)

    //verify all but search/querystring
    if(expectUrl.hostname === actualUrl.hostname &&
       expectUrl.host === actualUrl.host &&
       expectUrl.pathname === actualUrl.pathname &&
       expectUrl.protocol === actualUrl.protocol &&
           expectUrl.auth === actualUrl.auth) {
        return this.res
    }
    var err = new Error(util.format(msg,this.req.url,req.url))
    return err
}
Expectation.prototype.matchParams = function(req) {
    var msg = 'Expected request for %s with params "%s", but got "%s"'

    var expectParams = (this.req.params || {})
        , actualParams = url.parse(req.url, true).query
        , hasExpected = Object.keys(expectParams).length > 0
        , hasActual = Object.keys(actualParams).length > 0

    if(deepEqual(expectParams,actualParams)) {
        return this.res
    }
    var stringify = querystring.stringify
    expectParams = hasExpected ? stringify(expectParams) : '<NONE EXPECTED>'
    actualParams = hasActual ? stringify(actualParams) : '<NONE RECEIVED>'
    var err = new Error(util.format(msg,this.req.url,expectParams,actualParams))
    return err
}
Expectation.prototype.matchMethod = function(req) {
    var msg = 'Expected request for %s with method %s, but got method %s'
        ,method = (req.method || 'undefined')
    if(method.toLowerCase() === this.req.method.toLowerCase()){
        return this.res
    }

    var err = new Error(util.format(msg,this.req.url,this.req.method,method))
    return err
}
Expectation.prototype.matchBody = function(req) {
    var expectBody = this.req.body
        , actualBody = req.body
    if(deepEqual(expectBody,actualBody)) {
        return this.res
    }
    var msg = util.format('Expected request for %s to have body %s, but got %s',
                          this.req.url,JSON.stringify(expectBody,undefined,2),JSON.stringify(actualBody,undefined,2))
    var err = new Error(msg)
    return err
}
Expectation.prototype.matchHeaders = function(req) {
    var expectHeaders = this.req.headers || {}
        ,actualHeaders = req.headers || {}
        ,errs = []
    ;

    for(var k in expectHeaders) {
        var key = k.toLowerCase()
        var actual = actualHeaders[key]
        if(actual !== expectHeaders[key]) {
            var msg = util.format('Expected request for %s to have header %s with value %s'
                ,this.req.url,k,expectHeaders[k])
            errs.push(new Error(msg))
        }
    }
    var msgs = errs.map(function(err){
        return err.message
    })
    return (errs.length ? new Error(msgs) : this.res)
}

Expectation.prototype.toString = function(){
    return util.format('[%s requests] - %s %s, body: %s, headers: %s'
            , this.requestCount
            , this.req.method
            , this.req.url
            , JSON.stringify(this.req.headers)
            , JSON.stringify(this.req.body))
}

function defaultConfig(cfg,key,value) {
    cfg[key] = ((Object.hasOwnProperty.call(cfg,key)) ? cfg[key] : value)
    return cfg
}
/**
 * The expectation container that exposes `expect`,`invoke`, and [optional] `verify`
 * operations.
 * @param {Object} cfg
 *  @param {Boolean} strictOrder Throw if an request is made out of order from registration; otherwise, only throw if a match cannot be found
 *  @param {Boolean} verifiable Keep track of requests and throw if `verify` is called but some are still pending
 * @class Ersatz
 **/
function Ersatz(cfg) {
    cfg = (cfg || {})
    defaultConfig(cfg,'strictOrder',true)
    defaultConfig(cfg,'verifiable',true)
    this.cfg = cfg
    this.expectations = []
    this.promises = []
    this.expect= this.expect.bind(this)
    this.invoke = this.invoke.bind(this)
    this.verify = this.verify.bind(this)
    this.match = this.match.bind(this)
    this.invocations = []
}
Ersatz.prototype.expect = function(req, res) {
    try{
        this.expectations.push(new Expectation(req,res))
    } catch(err) {
        throw err
    }
    return this
}
Ersatz.prototype.match = function(req, expectation) {
    var expected = expectation.request || {}
    var urlMsg = 'Expected request for %s, but got %s'
    if(req.url !== expectation.request.url) {
        throw new Error(util.format(urlMsg,req.url,expected.url))
    }
}
/**
 * Finds expectation, given a request
 * @return {Expectation} if a match is found; otherwise {undefined}
 * */
Ersatz.prototype.findExpectation = function(req) {
    if(!this.expectations.length) {
        throw new Error('Expectations have not been made.')
    }
    var matches = (this.expectations || []).filter(function(exp){
        return !exp.fails(req)
    })
    if(!matches.length) {
        return undefined
    }
    return matches[0]
}
/**
 * Try to match this request against `expect`ed request/response pairs.
 * If match fails, throw
 * @method invoke
 * */
Ersatz.prototype.invoke = function(req) {
    this.invocations.push(req)
    var expectation;
    if(this.cfg.strictOrder) {
        expectation = this.expectations[(this.invocations.length - 1)]
    } else {
        expectation = this.findExpectation(req)
    }
    if(!expectation){
        var err = new Error('Unexpected request:' + JSON.stringify(req))
        throw err
    }
    var failure = expectation.fails(req)
    if(failure) {
        throw failure
    }
    expectation.mark()
    return expectation.res
}
/**
 * Discover the expectations which are pending, meaning a request has not been
 * made for them at least once.
 * @method pending
 * */
Ersatz.prototype.pending  = function(){
    return this.expectations.filter(function(exp){
        return (exp.requestCount < 1)
    })
}
Ersatz.prototype.verify = function(){
    if(!this.cfg.verifiable) {
        throw new Error('This ersatz is not verifiable')
    }
    var pending = this.pending()
    if(pending.length) {
        var msg = util.format('There are %s pending requests:\n%s'
            ,pending.length
            ,this.printExpectations())
        throw new Error(msg)
    }
    return this
}
/**
 * Convenience method for printing out expectations
 * @method printExpectations
 * @return {String} of \n delimited expectation output
 * */
Ersatz.prototype.printExpectations = function(){
    var expect = this.expectations.map(function(ex){
            return ex.toString()
            },this)
    var bullet = '\u25B8 '
        return bullet + expect.join('\n' + bullet)

}
