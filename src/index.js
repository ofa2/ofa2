import { isString, isFunction } from 'lodash';
import EventEmitter from 'events';
import Promise from 'bluebird';

const symbolLift = Symbol('_lift');
const SymbolCheckMiddleware = Symbol('_checkMiddleware');

process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('uncaughtException:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, p) => {
  // eslint-disable-next-line no-console
  console.log('Unhandled Rejection at:', p, 'reason:', reason);
  process.exit(1);
});

class Ofa2 extends EventEmitter {
  constructor(projectPath, options) {
    super();

    this.options = options || {};
    this.middlewares = [];

    if (!projectPath) {
      throw new Error('need projectPath param');
    }
    this.projectPath = projectPath;

    this.init();
  }

  init() {
    this.environment = (process.env.NODE_ENV || 'development').trim();
    this.promise = Promise.resolve();

    this.config = {};
    this.model = {};
    this.global = {};

    this.graphql = {};

    // 设置 alias
    if (this.options.alias) {
      global[this.options.alias] = this;
    }
    else {
      global.framework = this;
    }

    global.logger = console;
    global.logger.trace = global.logger.log;
    global.logger.debug = global.logger.log;
  }

  use(middlewareName) {
    let middleware;
    if (isFunction(middlewareName)) {
      middleware = middlewareName;
    }
    else if (isString(middlewareName)) {
      // TODO: 等待 import 支持 动态导入后取出 require;
      try {
        /* eslint-disable global-require */
        /* eslint-disable import/no-dynamic-require */
        middleware = require(`ofa2-${middlewareName}`);
      }
      catch (e) {
        // eslint-disable-next-line no-console
        console.warn(e);
        process.exit(1);
      }
    }
    else {
      throw new Error('middleware should be string or function');
    }

    this.middlewares.push(middleware.default ? middleware.default : middleware);
    return this;
  }

  async [SymbolCheckMiddleware](name) {
    await Promise.each(this.middlewares, (middleware) => {
      if (isFunction(middleware[name])) {
        return middleware[name].call(this);
      }
      return undefined;
    });

    this.emit(`${name}ed`);
  }

  async [symbolLift]() {
    await Promise.each(this.middlewares, (middleware) => {
      if (isFunction(middleware)) {
        return middleware.call(this);
      }
      if (isFunction(middleware.lift)) {
        return middleware.lift.call(this);
      }
      return undefined;
    });

    this.emit('lifted');
  }

  lift() {
    this.promise = this.promise.then(() => {
      this[symbolLift]();
    });
    return this;
  }

  listen() {
    this.promise = this.promise.then(() => {
      return this[SymbolCheckMiddleware]('listen');
    });
    return this;
  }

  lower() {
    this.promise = this.promise.then(() => {
      return this[SymbolCheckMiddleware]('lower');
    });
    return this;
  }
}

export default Ofa2;
