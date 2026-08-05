import { type ModuleConfig } from '@cool-midway/core';

/** Open Issue 插件后端模块入口；领域表和接口随插件源码接入 Host。 */
export default () =>
  ({
    name: 'Open Issue',
    description: 'Phoenix Admin Open Issue 业务插件',
    middlewares: [],
    globalMiddlewares: [],
    order: 20,
  } satisfies ModuleConfig);
