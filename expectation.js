'use strict';

var url = require('url')
    , Router = require('routes')
    , noop = function(){}
    , Promise = require('es6-promise').Promise
    , url = require('url')
    , util = require('util')
    , deepEqual = require('deep-equal')


module.exports = Expectation

function Expectation(cfg, opts) {
    var router = new Router()
        ,request = cfg.request || {}
    ;
    opts = (opts || {})
    this.cfg = cfg
    this.opts = {
        respondFailures: false
    }
    for(var k in this.opts) {
        if(opts.hasOwnProperty(k)) {
            this.opts[k] = opts[k]
        }
    }
    this.request = this.cfg.request || {
        url: this.cfg.url
        ,method: this.cfg.method
        ,headers: this.cfg.headers
        ,body: this.cfg.body
    }
    this.response = this.cfg.response || {}
    router.addRoute(this.request.url,noop)
    Object.defineProperty(this,'router',{
        enumerable: false
        ,writable: true
        ,configurable: true
        ,value: router
    })
}
Expectation.prototype.pass = function(req, res, ok) {
    var responseSpec = this.response || {}
    var statusCode = responseSpec.statusCode
        ,resBody = responseSpec.body
        ,resHeaders = responseSpec.headers || {}
        ;
    for(var h in resHeaders) {
        res.setHeader(h,resHeaders[h])
    }
    res.statusCode = (statusCode || 200)
    var msg = JSON.stringify(resBody || ok  || '')
    res.write(msg)
    return res.end()
}
Expectation.prototype.defaultFail = function(req, res, err) {
    var exception = {
        expected: this.request
        ,actual: {
            url: req.url
            ,headers: req.headers
            ,method: req.method
        }
        ,message: (err && err.message) || 'Bad request'
        ,statusCode: 400
    }
    return exception

}
Expectation.prototype.fail = function(req, res, err) {
    var promise = new Promise(function(resolve, reject){
        if(this.opts.respondFailures) {
            try {
                var failure = this.cfg.fail || this.defaultFail(req, res, err)
                failure.message = failure.message || (err && err.message)
                res.setHeader('content-type','text/plain')
                res.statusCode = failure.statusCode
                res.write(failure.message)
            } catch(err) {
                console.error('uncaught failure',err, err.stack)
                return reject(err.message)
            }
            return resolve(res.end())
        }
        return reject(err)
    }.bind(this))
    return promise
}

Expectation.prototype.matchMethod = function(req) {
    var expected = this.request
    var promise = new Promise(function(resolve, reject){
        var url = expected.url
        if(req.method.toUpperCase() === expected.method.toUpperCase()) {
            return resolve(this)
        }
        var msg = util.format('Expected request on %s with method %s, but got method %s',url,expected.method,req.method)
        return reject(new Error(msg))
    }.bind(this))
    return promise
}
Expectation.prototype.matchUrl = function(req) {
    var promise = new Promise(function(resolve, reject){
        if(!!this.router.match(req.url)) {
            return resolve(this)
        }
        var msg = util.format('Expected request on url %s, but got %s',this.request.url,req.url)
        return reject(new Error(msg))
    }.bind(this))
    return promise
}
Expectation.prototype.matchHeaders = function(req) {
    var promise = new Promise(function(resolve, reject){
        var reqHeaders = this.request.headers
        for(var k in reqHeaders) {
            var key = k.toLowerCase()
            //node lowercases incoming headers
            var actual = req.headers[key]
            if(actual !== reqHeaders[key]) {
                var msg = util.format('Expected request on %s to have header %s with value %s',req.url,k,reqHeaders[k])
                return reject(new Error(msg))
            }
        }
        return resolve(this)
    }.bind(this))
    return promise
}
Expectation.prototype.matchBody = function(req) {
    var promise = new Promise(function(resolve, reject){
        var method = req.method.toLowerCase()
            ,reqBody = this.request.body
            ,isJson = req.headers && (req.headers['accept'] || '').indexOf('json') > -1
        var writable = [ 'post', 'patch', 'put']
        if(writable.indexOf(method) < 0) {
            return resolve(this)
        }
        try {
            var body = ''
            req.on('data',function(data) {
                body += data
            }.bind(this))
            req.on('end',function(){
                var result = body
                if(isJson && body && body.length){
                    try {
                        result = JSON.parse(body)
                    } catch(err) {
                        if(err instanceof SyntaxError) {
                            return reject(err)
                        }
                        throw err
                    }
                }
                if(!!deepEqual(result,reqBody)) {
                    return resolve(this)
                }
                if(!reqBody && (!body || !body.length)) {
                    return resolve(this)
                }

                var msg = util.format('Expected request on %s with body %s, but got %s'
                    ,this.cfg.url,JSON.stringify(reqBody),JSON.stringify(result))
                return reject(new Error(msg))
            }.bind(this))
        } catch (err) {
            console.error('ERROR',err, err.stack)
            reject(err)
        }
    }.bind(this))
    return promise

}
Expectation.prototype.match = function(req, res) {
    var matchers = [
        this.matchUrl(req)
        ,this.matchMethod(req)
        ,this.matchHeaders(req)
        ,this.matchBody(req)
    ]
    var promise = Promise.all(matchers)
    return promise
        .then(this.pass.bind(this,req, res)
            ,this.fail.bind(this,req,res))
}
Expectation.prototype.toString = function(){
    return util.format('%s %s, body: %s, headers: %s'
        , this.request.method
        , this.request.url
        , JSON.stringify(this.request.headers)
        , JSON.stringify(this.request.body))
}


