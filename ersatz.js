'use strict';

var Promise = require('bluebird')
    ,util = require('util')
    ,deepEqual = require('deep-equal')
;

module.exports = Ersatz

function Expectation(req, res) {
    this.req = req
    this.res = res
    if(!this.req.url) {
        throw new Error('url is required for expectation')
    }
    if(!this.req.method) {
        throw new Error('method is required for expectation')
    }
}
Expectation.prototype.match = function(req) {
    var matchers = [
        this.matchUrl
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
    if(req.url === this.req.url) {
        return this.res
    }
    var err = new Error(util.format(msg,this.req.url,req.url))
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
    return util.format('%s %s, body: %s, headers: %s'
            , this.req.method
            , this.req.url
            , JSON.stringify(this.req.headers)
            , JSON.stringify(this.req.body))
}

function Ersatz() {
    this.expectations = []
    this.promises = []
    this.expect= this.expect.bind(this)
    this.invoke = this.invoke.bind(this)
    this.verify = this.verify.bind(this)
    this.match = this.match.bind(this)
}
Ersatz.prototype.expect = function(req, res) {
    try{
        this.expectations.push(new Expectation(req,res))
    } catch(err) {
        return Promise.reject(err)
    }
    return Promise.resolve(this)
}
Ersatz.prototype.match = function(req, expectation) {
    var expected = expectation.request || {}
    var urlMsg = 'Expected request for %s, but got %s'
    if(req.url !== expectation.request.url) {
        throw new Error(util.format(urlMsg,req.url,expected.url))
    }

}
Ersatz.prototype.invoke = function(req) {
    var promise = new Promise(function(resolve, reject) {
        var expectation = this.expectations.shift()
        if(!expectation){
            var err = new Error('Unexpected request:' + JSON.stringify(req))
            throw err
        }
        var failure = expectation.fails(req)
        if(failure) {
            return reject(failure)
        }
        return resolve(expectation.res)
    }.bind(this))
    return promise
}
Ersatz.prototype.verify = function(){
    var promise = new Promise(function(resolve, reject){
        if(this.expectations.length) {
            if(!this.flushed) {
                reject(new Error('Expectations have not been flushed. Please call `flush`.'))
            }
            var msg = util.format('There are %s pending requests:\n%s'
                ,this.expectations.length
                ,this.printExpectations())
            return reject(new Error(msg))
        }
        return resolve(this)
    }.bind(this))
    return promise
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
Ersatz.prototype.promise = function(promises) {
    var args = [].slice.call(arguments)

    if(args.length === 1 && Array.isArray(args[0])) {
        return Promise.all(args[0])
    }
    return Promise.all(args || [])
}
Ersatz.prototype.isPending = function(){
    return this.promises.filter(function(p){
        return p.isPending()
    }).length > 0

}
Ersatz.prototype.flush  = function(p){
    if(this.flushing){
        return this.flushing
    }
    this.flushing = new Promise(function(resolve, reject){
        var id = setInterval(function(){
            if(!this.isPending()){
                clearInterval(id)
                this.flushed = true
                resolve(this)
            }
        }.bind(this),4)
        Promise.onPossiblyUnhandledRejection(function(err){
            if(this.flushed) {
                console.error(err && err.message,err && err.stack)
                return
            }
            var result = reject(err)
            //clear this handler
            Promise.onPossiblyUnhandledRejection()
            return result
        })
    }.bind(this))
    return this.flushing
}
