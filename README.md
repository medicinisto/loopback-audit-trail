[![Build Status](https://travis-ci.org/yantrashala/loopback-audit-trail.svg?branch=master)](https://travis-ci.org/yantrashala/loopback-audit-trail)

# loopback-audit-logger
A component to add audit log capability to loopback projects

It's a fork from [loopback-audit-trail](https://github.com/yantrashala/loopback-audit-trail) which does not rely on the loopback context to store and access the current user. Instead it stores `currentUser` in `req`. Additionally it fixes an issue with recursive references which now allows to stream the logs to mongoDb and plays well with [bunyan-mongodb-logger](https://github.com/abd2561024/bunyan-mongodb-logger)

This logger works by attaching afterRemote and afterRemoteError methods on an API; this means it would work if API is called as http resource and not as method call. Following are logged as audit log. 

- HTTP method
- HTTP URL
- Model name
- Model method name
- Arguments as JSON object
  - Request params
  - Request query
  - Request headers
  - Method arguments
- Method result - This is the return object as specified in `returns` parameter of method declaration.
- Method error - In case of errors, it captures the error object as populated by loopback.
- User as JSON object
  - If user is associated with the current loopback access token then entire object is captured
  - If no accessToken is present then `user.name` is set to `ANONYMOUS`
- User IP address - It is captued in the user object as `user.ip`

## Sample usage with bunyan-mongodb-logger
In your server.js, before calling [boot](https://apidocs.strongloop.com/loopback-boot/#boot) initialize a [bunyan-mongodb-logger](https://github.com/trentm/node-bunyan) instance like

```
var bunyanMongoDbLogger = require('bunyan-mongodb-logger');
var log = bunyanMongoDbLogger({
  name: 'myApp',
  streams: ['stdout', 'mongodb'],
  url: 'mongodb://localhost:27017/logs',
});
```

Pass the instance of bunyan to [loopback-audit-trail](https://github.com/yantrashala/loopback-audit-trail) as
```
require('loopback-audit-trail')(log);
```

Add the following to initialize the component in your component-config.json.
```
"loopback-audit-trail": {}
```

## Sample usage with node-bunyan
Instead of a bunyan-mongodb-logger istance, initialize a [bunyan](https://github.com/trentm/node-bunyan) logger instance like

```
var bunyan = require('bunyan');
var log = bunyan.createLogger({name: "myapp"});
```

**P.S.** You should add the code to initialize logger component with bunyan logger before calling boot method of loopback.

## Use custom user model
To use with a custom user model you can attach it in `server.js` like

```
app.use(loopback.token());
app.use(function setCurrentUser(req, res, next) {
  if (!req.accessToken) {
    return next();
  }
  app.models.user.findById(req.accessToken.userId, function(err, user) {
    if (err) {
      return next(err);
    }
    if (!user) {
      return next(new Error('No user with this access token was found.'));
    }
    req.currentUser = user.toObject();
    next();
  });
});
```
