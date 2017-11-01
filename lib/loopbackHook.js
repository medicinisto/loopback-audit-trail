'use strict';

exports.init = function (app, config, auditLogger) {

    function log(context) {
        var auditLog = {};
        var method = context.method;
        var req = context.req;

        auditLog.method = req.method;
        auditLog.url = req.originalUrl;
        auditLog.eventName = method.sharedClass.name;
        auditLog.subEventName = method.name;
        auditLog.arguments = {
            params: req.params,
            query: req.query,
            headers: req.headers,
            args: context.args
        };

        // remove request and response because of size and circular references
        if (auditLog.arguments.args.req) {
            delete auditLog.arguments.args.req;
        }
        if (auditLog.arguments.args.res) {
            delete auditLog.arguments.args.res;
        }

        // use loopbacks toJSON to remove circular references from models
        auditLog.result = Array.isArray(context.result)
            ? context.result.map(function (entry) { return entry.toJSON(); })
            : ((context.result && context.result.toJSON) ? context.result.toJSON() : {});
        auditLog.error = context.error || {};
        auditLog.status = context.error
            ? (context.error.statusCode || context.error.status || context.res.statusCode)
            : (context.result && Object.keys(context.result) > 0 ? 200 : 204);

        var currentUser = {};

        var logWithUser = function () {
            currentUser.ip = req.ip ||
                req._remoteAddress ||
                (req.connection && req.connection.remoteAddress) ||
                undefined;
            auditLog.user = currentUser;

            // $ and . are not allowed as keys in mongo, so escape them all
            auditLog = JSON.parse(JSON.stringify(auditLog).replace(/\$/g, '___').replace(/\./g, '__'));

            process.nextTick(function () {
                auditLogger.info({'log': auditLog});
            });
        };

        try {
            if (!req.currentUser) {
                if (req.accessToken) {
                    app.models.User.findById(
                        req.accessToken.userId,
                        function (err, user) {
                            if (user) {
                                currentUser = user.toObject();
                                req.currentUser = currentUser;
                            } else {
                                currentUser.name = 'USER NOT FOUND';
                            }
                            logWithUser();
                        }
                    );
                } else {
                    currentUser.name = 'ANONYMOUS';
                    logWithUser();
                }
            } else {
                currentUser = req.currentUser;
                logWithUser();
            }
        } catch (e) {
            // catch logging error to prevent them from kiling the process
            console.log(e);
        }
    }

    var models = app.models();
    models.forEach(function (Model) {

        Model.afterRemote('**', function (context, unused, next) {
            log(context);
            next();
        });
        Model.afterRemoteError('**', function (context, next) {
            log(context);
            next();
        });
    });
};
