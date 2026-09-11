import { Controller, Get } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', 'OPTIONS', 'HEAD'];

@Controller()
export class AppController {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
  ) {}

  @Get()
  listEndpoints() {
    const endpoints: { method: string; path: string }[] = [];

    for (const wrapper of this.discoveryService.getControllers()) {
      const { instance, metatype } = wrapper;
      if (!instance || !metatype) continue;

      const controllerPath: string = Reflect.getMetadata(PATH_METADATA, metatype) || '';
      const prototype = Object.getPrototypeOf(instance);

      for (const methodName of Array.from(this.metadataScanner.getAllMethodNames(prototype))) {
        const handler = prototype[methodName];
        const routePath = Reflect.getMetadata(PATH_METADATA, handler);
        const routeMethod = Reflect.getMetadata(METHOD_METADATA, handler);
        if (routePath === undefined || routeMethod === undefined) continue;

        const fullPath = ['/api', controllerPath, routePath === '/' ? '' : routePath]
          .filter(Boolean)
          .join('/')
          .replace(/\/+/g, '/');

        endpoints.push({ method: HTTP_METHODS[routeMethod] ?? 'GET', path: fullPath });
      }
    }

    return {
      name: 'Reflection Backend API',
      status: 'ok',
      endpointCount: endpoints.length,
      endpoints: endpoints.sort((a, b) => a.path.localeCompare(b.path)),
    };
  }
}
