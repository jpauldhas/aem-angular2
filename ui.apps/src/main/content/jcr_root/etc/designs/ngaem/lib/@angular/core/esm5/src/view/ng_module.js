/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
import { resolveForwardRef } from '../di/forward_ref';
import { INJECTOR, Injector, setCurrentInjector } from '../di/injector';
import { APP_ROOT } from '../di/scope';
import { NgModuleRef } from '../linker/ng_module_factory';
import { stringify } from '../util';
import { splitDepsDsl, tokenKey } from './util';
var UNDEFINED_VALUE = new Object();
var InjectorRefTokenKey = tokenKey(Injector);
var INJECTORRefTokenKey = tokenKey(INJECTOR);
var NgModuleRefTokenKey = tokenKey(NgModuleRef);
export function moduleProvideDef(flags, token, value, deps) {
    // Need to resolve forwardRefs as e.g. for `useValue` we
    // lowered the expression and then stopped evaluating it,
    // i.e. also didn't unwrap it.
    value = resolveForwardRef(value);
    var depDefs = splitDepsDsl(deps, stringify(token));
    return {
        // will bet set by the module definition
        index: -1,
        deps: depDefs, flags: flags, token: token, value: value
    };
}
export function moduleDef(providers) {
    var providersByKey = {};
    var modules = [];
    var isRoot = false;
    for (var i = 0; i < providers.length; i++) {
        var provider = providers[i];
        if (provider.token === APP_ROOT) {
            isRoot = true;
        }
        if (provider.flags & 1073741824 /* TypeNgModule */) {
            modules.push(provider.token);
        }
        provider.index = i;
        providersByKey[tokenKey(provider.token)] = provider;
    }
    return {
        // Will be filled later...
        factory: null,
        providersByKey: providersByKey,
        providers: providers,
        modules: modules,
        isRoot: isRoot,
    };
}
export function initNgModule(data) {
    var def = data._def;
    var providers = data._providers = new Array(def.providers.length);
    for (var i = 0; i < def.providers.length; i++) {
        var provDef = def.providers[i];
        if (!(provDef.flags & 4096 /* LazyProvider */)) {
            // Make sure the provider has not been already initialized outside this loop.
            if (providers[i] === undefined) {
                providers[i] = _createProviderInstance(data, provDef);
            }
        }
    }
}
export function resolveNgModuleDep(data, depDef, notFoundValue) {
    if (notFoundValue === void 0) { notFoundValue = Injector.THROW_IF_NOT_FOUND; }
    var former = setCurrentInjector(data);
    try {
        if (depDef.flags & 8 /* Value */) {
            return depDef.token;
        }
        if (depDef.flags & 2 /* Optional */) {
            notFoundValue = null;
        }
        if (depDef.flags & 1 /* SkipSelf */) {
            return data._parent.get(depDef.token, notFoundValue);
        }
        var tokenKey_1 = depDef.tokenKey;
        switch (tokenKey_1) {
            case InjectorRefTokenKey:
            case INJECTORRefTokenKey:
            case NgModuleRefTokenKey:
                return data;
        }
        var providerDef = data._def.providersByKey[tokenKey_1];
        if (providerDef) {
            var providerInstance = data._providers[providerDef.index];
            if (providerInstance === undefined) {
                providerInstance = data._providers[providerDef.index] =
                    _createProviderInstance(data, providerDef);
            }
            return providerInstance === UNDEFINED_VALUE ? undefined : providerInstance;
        }
        else if (depDef.token.ngInjectableDef && targetsModule(data, depDef.token.ngInjectableDef)) {
            var injectableDef = depDef.token.ngInjectableDef;
            var key = tokenKey_1;
            var index = data._providers.length;
            data._def.providersByKey[depDef.tokenKey] = {
                flags: 1024 /* TypeFactoryProvider */ | 4096 /* LazyProvider */,
                value: injectableDef.factory,
                deps: [], index: index,
                token: depDef.token,
            };
            data._providers[index] = UNDEFINED_VALUE;
            return (data._providers[index] =
                _createProviderInstance(data, data._def.providersByKey[depDef.tokenKey]));
        }
        return data._parent.get(depDef.token, notFoundValue);
    }
    finally {
        setCurrentInjector(former);
    }
}
function moduleTransitivelyPresent(ngModule, scope) {
    return ngModule._def.modules.indexOf(scope) > -1;
}
function targetsModule(ngModule, def) {
    return def.providedIn != null && (moduleTransitivelyPresent(ngModule, def.providedIn) ||
        def.providedIn === 'root' && ngModule._def.isRoot);
}
function _createProviderInstance(ngModule, providerDef) {
    var injectable;
    switch (providerDef.flags & 201347067 /* Types */) {
        case 512 /* TypeClassProvider */:
            injectable = _createClass(ngModule, providerDef.value, providerDef.deps);
            break;
        case 1024 /* TypeFactoryProvider */:
            injectable = _callFactory(ngModule, providerDef.value, providerDef.deps);
            break;
        case 2048 /* TypeUseExistingProvider */:
            injectable = resolveNgModuleDep(ngModule, providerDef.deps[0]);
            break;
        case 256 /* TypeValueProvider */:
            injectable = providerDef.value;
            break;
    }
    // The read of `ngOnDestroy` here is slightly expensive as it's megamorphic, so it should be
    // avoided if possible. The sequence of checks here determines whether ngOnDestroy needs to be
    // checked. It might not if the `injectable` isn't an object or if NodeFlags.OnDestroy is already
    // set (ngOnDestroy was detected statically).
    if (injectable !== UNDEFINED_VALUE && injectable != null && typeof injectable === 'object' &&
        !(providerDef.flags & 131072 /* OnDestroy */) && typeof injectable.ngOnDestroy === 'function') {
        providerDef.flags |= 131072 /* OnDestroy */;
    }
    return injectable === undefined ? UNDEFINED_VALUE : injectable;
}
function _createClass(ngModule, ctor, deps) {
    var len = deps.length;
    switch (len) {
        case 0:
            return new ctor();
        case 1:
            return new ctor(resolveNgModuleDep(ngModule, deps[0]));
        case 2:
            return new ctor(resolveNgModuleDep(ngModule, deps[0]), resolveNgModuleDep(ngModule, deps[1]));
        case 3:
            return new ctor(resolveNgModuleDep(ngModule, deps[0]), resolveNgModuleDep(ngModule, deps[1]), resolveNgModuleDep(ngModule, deps[2]));
        default:
            var depValues = new Array(len);
            for (var i = 0; i < len; i++) {
                depValues[i] = resolveNgModuleDep(ngModule, deps[i]);
            }
            return new (ctor.bind.apply(ctor, tslib_1.__spread([void 0], depValues)))();
    }
}
function _callFactory(ngModule, factory, deps) {
    var len = deps.length;
    switch (len) {
        case 0:
            return factory();
        case 1:
            return factory(resolveNgModuleDep(ngModule, deps[0]));
        case 2:
            return factory(resolveNgModuleDep(ngModule, deps[0]), resolveNgModuleDep(ngModule, deps[1]));
        case 3:
            return factory(resolveNgModuleDep(ngModule, deps[0]), resolveNgModuleDep(ngModule, deps[1]), resolveNgModuleDep(ngModule, deps[2]));
        default:
            var depValues = Array(len);
            for (var i = 0; i < len; i++) {
                depValues[i] = resolveNgModuleDep(ngModule, deps[i]);
            }
            return factory.apply(void 0, tslib_1.__spread(depValues));
    }
}
export function callNgModuleLifecycle(ngModule, lifecycles) {
    var def = ngModule._def;
    var destroyed = new Set();
    for (var i = 0; i < def.providers.length; i++) {
        var provDef = def.providers[i];
        if (provDef.flags & 131072 /* OnDestroy */) {
            var instance = ngModule._providers[i];
            if (instance && instance !== UNDEFINED_VALUE) {
                var onDestroy = instance.ngOnDestroy;
                if (typeof onDestroy === 'function' && !destroyed.has(instance)) {
                    onDestroy.apply(instance);
                    destroyed.add(instance);
                }
            }
        }
    }
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmdfbW9kdWxlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29yZS9zcmMvdmlldy9uZ19tb2R1bGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFTQSxPQUFPLEVBQUMsaUJBQWlCLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUNwRCxPQUFPLEVBQUMsUUFBUSxFQUFlLFFBQVEsRUFBRSxrQkFBa0IsRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBQ25GLE9BQU8sRUFBQyxRQUFRLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFDckMsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLDZCQUE2QixDQUFDO0FBQ3hELE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFHbEMsT0FBTyxFQUFDLFlBQVksRUFBRSxRQUFRLEVBQUMsTUFBTSxRQUFRLENBQUM7QUFFOUMsSUFBTSxlQUFlLEdBQUcsSUFBSSxNQUFNLEVBQUUsQ0FBQztBQUVyQyxJQUFNLG1CQUFtQixHQUFHLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUMvQyxJQUFNLG1CQUFtQixHQUFHLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUMvQyxJQUFNLG1CQUFtQixHQUFHLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUVsRCxNQUFNLDJCQUNGLEtBQWdCLEVBQUUsS0FBVSxFQUFFLEtBQVUsRUFDeEMsSUFBK0I7Ozs7SUFJakMsS0FBSyxHQUFHLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ2pDLElBQU0sT0FBTyxHQUFHLFlBQVksQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDckQsTUFBTSxDQUFDOztRQUVMLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDVCxJQUFJLEVBQUUsT0FBTyxFQUFFLEtBQUssT0FBQSxFQUFFLEtBQUssT0FBQSxFQUFF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Q0FBQyxDQUFDO1FBQ2pDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLHlCQUFzQixDQUFDLENBQUMsQ0FBQztZQUN4QyxJQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3hDLEVBQUUsQ0FBQyxDQUFDLFFBQVEsSUFBSSxRQUFRLEtBQUssZUFBZSxDQUFDLENBQUMsQ0FBQztnQkFDN0MsSUFBTSxTQUFTLEdBQXVCLFFBQVEsQ0FBQyxXQUFXLENBQUM7Z0JBQzNELEVBQUUsQ0FBQyxDQUFDLE9BQU8sU0FBUyxLQUFLLFVBQVUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUNoRSxTQUFTLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO29CQUMxQixTQUFTLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2lCQUN6QjthQUNGO1NBQ0Y7S0FDRjtDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0luamVjdGFibGVEZWZ9IGZyb20gJy4uL2RpL2RlZnMnO1xuaW1wb3J0IHtyZXNvbHZlRm9yd2FyZFJlZn0gZnJvbSAnLi4vZGkvZm9yd2FyZF9yZWYnO1xuaW1wb3J0IHtJTkpFQ1RPUiwgSW5qZWN0RmxhZ3MsIEluamVjdG9yLCBzZXRDdXJyZW50SW5qZWN0b3J9IGZyb20gJy4uL2RpL2luamVjdG9yJztcbmltcG9ydCB7QVBQX1JPT1R9IGZyb20gJy4uL2RpL3Njb3BlJztcbmltcG9ydCB7TmdNb2R1bGVSZWZ9IGZyb20gJy4uL2xpbmtlci9uZ19tb2R1bGVfZmFjdG9yeSc7XG5pbXBvcnQge3N0cmluZ2lmeX0gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7RGVwRGVmLCBEZXBGbGFncywgTmdNb2R1bGVEYXRhLCBOZ01vZHVsZURlZmluaXRpb24sIE5nTW9kdWxlUHJvdmlkZXJEZWYsIE5vZGVGbGFnc30gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQge3NwbGl0RGVwc0RzbCwgdG9rZW5LZXl9IGZyb20gJy4vdXRpbCc7XG5cbmNvbnN0IFVOREVGSU5FRF9WQUxVRSA9IG5ldyBPYmplY3QoKTtcblxuY29uc3QgSW5qZWN0b3JSZWZUb2tlbktleSA9IHRva2VuS2V5KEluamVjdG9yKTtcbmNvbnN0IElOSkVDVE9SUmVmVG9rZW5LZXkgPSB0b2tlbktleShJTkpFQ1RPUik7XG5jb25zdCBOZ01vZHVsZVJlZlRva2VuS2V5ID0gdG9rZW5LZXkoTmdNb2R1bGVSZWYpO1xuXG5leHBvcnQgZnVuY3Rpb24gbW9kdWxlUHJvdmlkZURlZihcbiAgICBmbGFnczogTm9kZUZsYWdzLCB0b2tlbjogYW55LCB2YWx1ZTogYW55LFxuICAgIGRlcHM6IChbRGVwRmxhZ3MsIGFueV0gfCBhbnkpW10pOiBOZ01vZHVsZVByb3ZpZGVyRGVmIHtcbiAgLy8gTmVlZCB0byByZXNvbHZlIGZvcndhcmRSZWZzIGFzIGUuZy4gZm9yIGB1c2VWYWx1ZWAgd2VcbiAgLy8gbG93ZXJlZCB0aGUgZXhwcmVzc2lvbiBhbmQgdGhlbiBzdG9wcGVkIGV2YWx1YXRpbmcgaXQsXG4gIC8vIGkuZS4gYWxzbyBkaWRuJ3QgdW53cmFwIGl0LlxuICB2YWx1ZSA9IHJlc29sdmVGb3J3YXJkUmVmKHZhbHVlKTtcbiAgY29uc3QgZGVwRGVmcyA9IHNwbGl0RGVwc0RzbChkZXBzLCBzdHJpbmdpZnkodG9rZW4pKTtcbiAgcmV0dXJuIHtcbiAgICAvLyB3aWxsIGJldCBzZXQgYnkgdGhlIG1vZHVsZSBkZWZpbml0aW9uXG4gICAgaW5kZXg6IC0xLFxuICAgIGRlcHM6IGRlcERlZnMsIGZsYWdzLCB0b2tlbiwgdmFsdWVcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1vZHVsZURlZihwcm92aWRlcnM6IE5nTW9kdWxlUHJvdmlkZXJEZWZbXSk6IE5nTW9kdWxlRGVmaW5pdGlvbiB7XG4gIGNvbnN0IHByb3ZpZGVyc0J5S2V5OiB7W2tleTogc3RyaW5nXTogTmdNb2R1bGVQcm92aWRlckRlZn0gPSB7fTtcbiAgY29uc3QgbW9kdWxlcyA9IFtdO1xuICBsZXQgaXNSb290OiBib29sZWFuID0gZmFsc2U7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcHJvdmlkZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgcHJvdmlkZXIgPSBwcm92aWRlcnNbaV07XG4gICAgaWYgKHByb3ZpZGVyLnRva2VuID09PSBBUFBfUk9PVCkge1xuICAgICAgaXNSb290ID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHByb3ZpZGVyLmZsYWdzICYgTm9kZUZsYWdzLlR5cGVOZ01vZHVsZSkge1xuICAgICAgbW9kdWxlcy5wdXNoKHByb3ZpZGVyLnRva2VuKTtcbiAgICB9XG4gICAgcHJvdmlkZXIuaW5kZXggPSBpO1xuICAgIHByb3ZpZGVyc0J5S2V5W3Rva2VuS2V5KHByb3ZpZGVyLnRva2VuKV0gPSBwcm92aWRlcjtcbiAgfVxuICByZXR1cm4ge1xuICAgIC8vIFdpbGwgYmUgZmlsbGVkIGxhdGVyLi4uXG4gICAgZmFjdG9yeTogbnVsbCxcbiAgICBwcm92aWRlcnNCeUtleSxcbiAgICBwcm92aWRlcnMsXG4gICAgbW9kdWxlcyxcbiAgICBpc1Jvb3QsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbml0TmdNb2R1bGUoZGF0YTogTmdNb2R1bGVEYXRhKSB7XG4gIGNvbnN0IGRlZiA9IGRhdGEuX2RlZjtcbiAgY29uc3QgcHJvdmlkZXJzID0gZGF0YS5fcHJvdmlkZXJzID0gbmV3IEFycmF5KGRlZi5wcm92aWRlcnMubGVuZ3RoKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBkZWYucHJvdmlkZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgcHJvdkRlZiA9IGRlZi5wcm92aWRlcnNbaV07XG4gICAgaWYgKCEocHJvdkRlZi5mbGFncyAmIE5vZGVGbGFncy5MYXp5UHJvdmlkZXIpKSB7XG4gICAgICAvLyBNYWtlIHN1cmUgdGhlIHByb3ZpZGVyIGhhcyBub3QgYmVlbiBhbHJlYWR5IGluaXRpYWxpemVkIG91dHNpZGUgdGhpcyBsb29wLlxuICAgICAgaWYgKHByb3ZpZGVyc1tpXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHByb3ZpZGVyc1tpXSA9IF9jcmVhdGVQcm92aWRlckluc3RhbmNlKGRhdGEsIHByb3ZEZWYpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZU5nTW9kdWxlRGVwKFxuICAgIGRhdGE6IE5nTW9kdWxlRGF0YSwgZGVwRGVmOiBEZXBEZWYsIG5vdEZvdW5kVmFsdWU6IGFueSA9IEluamVjdG9yLlRIUk9XX0lGX05PVF9GT1VORCk6IGFueSB7XG4gIGNvbnN0IGZvcm1lciA9IHNldEN1cnJlbnRJbmplY3RvcihkYXRhKTtcbiAgdHJ5IHtcbiAgICBpZiAoZGVwRGVmLmZsYWdzICYgRGVwRmxhZ3MuVmFsdWUpIHtcbiAgICAgIHJldHVybiBkZXBEZWYudG9rZW47XG4gICAgfVxuICAgIGlmIChkZXBEZWYuZmxhZ3MgJiBEZXBGbGFncy5PcHRpb25hbCkge1xuICAgICAgbm90Rm91bmRWYWx1ZSA9IG51bGw7XG4gICAgfVxuICAgIGlmIChkZXBEZWYuZmxhZ3MgJiBEZXBGbGFncy5Ta2lwU2VsZikge1xuICAgICAgcmV0dXJuIGRhdGEuX3BhcmVudC5nZXQoZGVwRGVmLnRva2VuLCBub3RGb3VuZFZhbHVlKTtcbiAgICB9XG4gICAgY29uc3QgdG9rZW5LZXkgPSBkZXBEZWYudG9rZW5LZXk7XG4gICAgc3dpdGNoICh0b2tlbktleSkge1xuICAgICAgY2FzZSBJbmplY3RvclJlZlRva2VuS2V5OlxuICAgICAgY2FzZSBJTkpFQ1RPUlJlZlRva2VuS2V5OlxuICAgICAgY2FzZSBOZ01vZHVsZVJlZlRva2VuS2V5OlxuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICB9XG4gICAgY29uc3QgcHJvdmlkZXJEZWYgPSBkYXRhLl9kZWYucHJvdmlkZXJzQnlLZXlbdG9rZW5LZXldO1xuICAgIGlmIChwcm92aWRlckRlZikge1xuICAgICAgbGV0IHByb3ZpZGVySW5zdGFuY2UgPSBkYXRhLl9wcm92aWRlcnNbcHJvdmlkZXJEZWYuaW5kZXhdO1xuICAgICAgaWYgKHByb3ZpZGVySW5zdGFuY2UgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBwcm92aWRlckluc3RhbmNlID0gZGF0YS5fcHJvdmlkZXJzW3Byb3ZpZGVyRGVmLmluZGV4XSA9XG4gICAgICAgICAgICBfY3JlYXRlUHJvdmlkZXJJbnN0YW5jZShkYXRhLCBwcm92aWRlckRlZik7XG4gICAgICB9XG4gICAgICByZXR1cm4gcHJvdmlkZXJJbnN0YW5jZSA9PT0gVU5ERUZJTkVEX1ZBTFVFID8gdW5kZWZpbmVkIDogcHJvdmlkZXJJbnN0YW5jZTtcbiAgICB9IGVsc2UgaWYgKGRlcERlZi50b2tlbi5uZ0luamVjdGFibGVEZWYgJiYgdGFyZ2V0c01vZHVsZShkYXRhLCBkZXBEZWYudG9rZW4ubmdJbmplY3RhYmxlRGVmKSkge1xuICAgICAgY29uc3QgaW5qZWN0YWJsZURlZiA9IGRlcERlZi50b2tlbi5uZ0luamVjdGFibGVEZWYgYXMgSW5qZWN0YWJsZURlZjxhbnk+O1xuICAgICAgY29uc3Qga2V5ID0gdG9rZW5LZXk7XG4gICAgICBjb25zdCBpbmRleCA9IGRhdGEuX3Byb3ZpZGVycy5sZW5ndGg7XG4gICAgICBkYXRhLl9kZWYucHJvdmlkZXJzQnlLZXlbZGVwRGVmLnRva2VuS2V5XSA9IHtcbiAgICAgICAgZmxhZ3M6IE5vZGVGbGFncy5UeXBlRmFjdG9yeVByb3ZpZGVyIHwgTm9kZUZsYWdzLkxhenlQcm92aWRlcixcbiAgICAgICAgdmFsdWU6IGluamVjdGFibGVEZWYuZmFjdG9yeSxcbiAgICAgICAgZGVwczogW10sIGluZGV4LFxuICAgICAgICB0b2tlbjogZGVwRGVmLnRva2VuLFxuICAgICAgfTtcbiAgICAgIGRhdGEuX3Byb3ZpZGVyc1tpbmRleF0gPSBVTkRFRklORURfVkFMVUU7XG4gICAgICByZXR1cm4gKFxuICAgICAgICAgIGRhdGEuX3Byb3ZpZGVyc1tpbmRleF0gPVxuICAgICAgICAgICAgICBfY3JlYXRlUHJvdmlkZXJJbnN0YW5jZShkYXRhLCBkYXRhLl9kZWYucHJvdmlkZXJzQnlLZXlbZGVwRGVmLnRva2VuS2V5XSkpO1xuICAgIH1cbiAgICByZXR1cm4gZGF0YS5fcGFyZW50LmdldChkZXBEZWYudG9rZW4sIG5vdEZvdW5kVmFsdWUpO1xuICB9IGZpbmFsbHkge1xuICAgIHNldEN1cnJlbnRJbmplY3Rvcihmb3JtZXIpO1xuICB9XG59XG5cbmZ1bmN0aW9uIG1vZHVsZVRyYW5zaXRpdmVseVByZXNlbnQobmdNb2R1bGU6IE5nTW9kdWxlRGF0YSwgc2NvcGU6IGFueSk6IGJvb2xlYW4ge1xuICByZXR1cm4gbmdNb2R1bGUuX2RlZi5tb2R1bGVzLmluZGV4T2Yoc2NvcGUpID4gLTE7XG59XG5cbmZ1bmN0aW9uIHRhcmdldHNNb2R1bGUobmdNb2R1bGU6IE5nTW9kdWxlRGF0YSwgZGVmOiBJbmplY3RhYmxlRGVmPGFueT4pOiBib29sZWFuIHtcbiAgcmV0dXJuIGRlZi5wcm92aWRlZEluICE9IG51bGwgJiYgKG1vZHVsZVRyYW5zaXRpdmVseVByZXNlbnQobmdNb2R1bGUsIGRlZi5wcm92aWRlZEluKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmLnByb3ZpZGVkSW4gPT09ICdyb290JyAmJiBuZ01vZHVsZS5fZGVmLmlzUm9vdCk7XG59XG5cbmZ1bmN0aW9uIF9jcmVhdGVQcm92aWRlckluc3RhbmNlKG5nTW9kdWxlOiBOZ01vZHVsZURhdGEsIHByb3ZpZGVyRGVmOiBOZ01vZHVsZVByb3ZpZGVyRGVmKTogYW55IHtcbiAgbGV0IGluamVjdGFibGU6IGFueTtcbiAgc3dpdGNoIChwcm92aWRlckRlZi5mbGFncyAmIE5vZGVGbGFncy5UeXBlcykge1xuICAgIGNhc2UgTm9kZUZsYWdzLlR5cGVDbGFzc1Byb3ZpZGVyOlxuICAgICAgaW5qZWN0YWJsZSA9IF9jcmVhdGVDbGFzcyhuZ01vZHVsZSwgcHJvdmlkZXJEZWYudmFsdWUsIHByb3ZpZGVyRGVmLmRlcHMpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBOb2RlRmxhZ3MuVHlwZUZhY3RvcnlQcm92aWRlcjpcbiAgICAgIGluamVjdGFibGUgPSBfY2FsbEZhY3RvcnkobmdNb2R1bGUsIHByb3ZpZGVyRGVmLnZhbHVlLCBwcm92aWRlckRlZi5kZXBzKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgTm9kZUZsYWdzLlR5cGVVc2VFeGlzdGluZ1Byb3ZpZGVyOlxuICAgICAgaW5qZWN0YWJsZSA9IHJlc29sdmVOZ01vZHVsZURlcChuZ01vZHVsZSwgcHJvdmlkZXJEZWYuZGVwc1swXSk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIE5vZGVGbGFncy5UeXBlVmFsdWVQcm92aWRlcjpcbiAgICAgIGluamVjdGFibGUgPSBwcm92aWRlckRlZi52YWx1ZTtcbiAgICAgIGJyZWFrO1xuICB9XG5cbiAgLy8gVGhlIHJlYWQgb2YgYG5nT25EZXN0cm95YCBoZXJlIGlzIHNsaWdodGx5IGV4cGVuc2l2ZSBhcyBpdCdzIG1lZ2Ftb3JwaGljLCBzbyBpdCBzaG91bGQgYmVcbiAgLy8gYXZvaWRlZCBpZiBwb3NzaWJsZS4gVGhlIHNlcXVlbmNlIG9mIGNoZWNrcyBoZXJlIGRldGVybWluZXMgd2hldGhlciBuZ09uRGVzdHJveSBuZWVkcyB0byBiZVxuICAvLyBjaGVja2VkLiBJdCBtaWdodCBub3QgaWYgdGhlIGBpbmplY3RhYmxlYCBpc24ndCBhbiBvYmplY3Qgb3IgaWYgTm9kZUZsYWdzLk9uRGVzdHJveSBpcyBhbHJlYWR5XG4gIC8vIHNldCAobmdPbkRlc3Ryb3kgd2FzIGRldGVjdGVkIHN0YXRpY2FsbHkpLlxuICBpZiAoaW5qZWN0YWJsZSAhPT0gVU5ERUZJTkVEX1ZBTFVFICYmIGluamVjdGFibGUgIT0gbnVsbCAmJiB0eXBlb2YgaW5qZWN0YWJsZSA9PT0gJ29iamVjdCcgJiZcbiAgICAgICEocHJvdmlkZXJEZWYuZmxhZ3MgJiBOb2RlRmxhZ3MuT25EZXN0cm95KSAmJiB0eXBlb2YgaW5qZWN0YWJsZS5uZ09uRGVzdHJveSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHByb3ZpZGVyRGVmLmZsYWdzIHw9IE5vZGVGbGFncy5PbkRlc3Ryb3k7XG4gIH1cbiAgcmV0dXJuIGluamVjdGFibGUgPT09IHVuZGVmaW5lZCA/IFVOREVGSU5FRF9WQUxVRSA6IGluamVjdGFibGU7XG59XG5cbmZ1bmN0aW9uIF9jcmVhdGVDbGFzcyhuZ01vZHVsZTogTmdNb2R1bGVEYXRhLCBjdG9yOiBhbnksIGRlcHM6IERlcERlZltdKTogYW55IHtcbiAgY29uc3QgbGVuID0gZGVwcy5sZW5ndGg7XG4gIHN3aXRjaCAobGVuKSB7XG4gICAgY2FzZSAwOlxuICAgICAgcmV0dXJuIG5ldyBjdG9yKCk7XG4gICAgY2FzZSAxOlxuICAgICAgcmV0dXJuIG5ldyBjdG9yKHJlc29sdmVOZ01vZHVsZURlcChuZ01vZHVsZSwgZGVwc1swXSkpO1xuICAgIGNhc2UgMjpcbiAgICAgIHJldHVybiBuZXcgY3RvcihyZXNvbHZlTmdNb2R1bGVEZXAobmdNb2R1bGUsIGRlcHNbMF0pLCByZXNvbHZlTmdNb2R1bGVEZXAobmdNb2R1bGUsIGRlcHNbMV0pKTtcbiAgICBjYXNlIDM6XG4gICAgICByZXR1cm4gbmV3IGN0b3IoXG4gICAgICAgICAgcmVzb2x2ZU5nTW9kdWxlRGVwKG5nTW9kdWxlLCBkZXBzWzBdKSwgcmVzb2x2ZU5nTW9kdWxlRGVwKG5nTW9kdWxlLCBkZXBzWzFdKSxcbiAgICAgICAgICByZXNvbHZlTmdNb2R1bGVEZXAobmdNb2R1bGUsIGRlcHNbMl0pKTtcbiAgICBkZWZhdWx0OlxuICAgICAgY29uc3QgZGVwVmFsdWVzID0gbmV3IEFycmF5KGxlbik7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGRlcFZhbHVlc1tpXSA9IHJlc29sdmVOZ01vZHVsZURlcChuZ01vZHVsZSwgZGVwc1tpXSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IGN0b3IoLi4uZGVwVmFsdWVzKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBfY2FsbEZhY3RvcnkobmdNb2R1bGU6IE5nTW9kdWxlRGF0YSwgZmFjdG9yeTogYW55LCBkZXBzOiBEZXBEZWZbXSk6IGFueSB7XG4gIGNvbnN0IGxlbiA9IGRlcHMubGVuZ3RoO1xuICBzd2l0Y2ggKGxlbikge1xuICAgIGNhc2UgMDpcbiAgICAgIHJldHVybiBmYWN0b3J5KCk7XG4gICAgY2FzZSAxOlxuICAgICAgcmV0dXJuIGZhY3RvcnkocmVzb2x2ZU5nTW9kdWxlRGVwKG5nTW9kdWxlLCBkZXBzWzBdKSk7XG4gICAgY2FzZSAyOlxuICAgICAgcmV0dXJuIGZhY3RvcnkocmVzb2x2ZU5nTW9kdWxlRGVwKG5nTW9kdWxlLCBkZXBzWzBdKSwgcmVzb2x2ZU5nTW9kdWxlRGVwKG5nTW9kdWxlLCBkZXBzWzFdKSk7XG4gICAgY2FzZSAzOlxuICAgICAgcmV0dXJuIGZhY3RvcnkoXG4gICAgICAgICAgcmVzb2x2ZU5nTW9kdWxlRGVwKG5nTW9kdWxlLCBkZXBzWzBdKSwgcmVzb2x2ZU5nTW9kdWxlRGVwKG5nTW9kdWxlLCBkZXBzWzFdKSxcbiAgICAgICAgICByZXNvbHZlTmdNb2R1bGVEZXAobmdNb2R1bGUsIGRlcHNbMl0pKTtcbiAgICBkZWZhdWx0OlxuICAgICAgY29uc3QgZGVwVmFsdWVzID0gQXJyYXkobGVuKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgZGVwVmFsdWVzW2ldID0gcmVzb2x2ZU5nTW9kdWxlRGVwKG5nTW9kdWxlLCBkZXBzW2ldKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWN0b3J5KC4uLmRlcFZhbHVlcyk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNhbGxOZ01vZHVsZUxpZmVjeWNsZShuZ01vZHVsZTogTmdNb2R1bGVEYXRhLCBsaWZlY3ljbGVzOiBOb2RlRmxhZ3MpIHtcbiAgY29uc3QgZGVmID0gbmdNb2R1bGUuX2RlZjtcbiAgY29uc3QgZGVzdHJveWVkID0gbmV3IFNldDxhbnk+KCk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgZGVmLnByb3ZpZGVycy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHByb3ZEZWYgPSBkZWYucHJvdmlkZXJzW2ldO1xuICAgIGlmIChwcm92RGVmLmZsYWdzICYgTm9kZUZsYWdzLk9uRGVzdHJveSkge1xuICAgICAgY29uc3QgaW5zdGFuY2UgPSBuZ01vZHVsZS5fcHJvdmlkZXJzW2ldO1xuICAgICAgaWYgKGluc3RhbmNlICYmIGluc3RhbmNlICE9PSBVTkRFRklORURfVkFMVUUpIHtcbiAgICAgICAgY29uc3Qgb25EZXN0cm95OiBGdW5jdGlvbnx1bmRlZmluZWQgPSBpbnN0YW5jZS5uZ09uRGVzdHJveTtcbiAgICAgICAgaWYgKHR5cGVvZiBvbkRlc3Ryb3kgPT09ICdmdW5jdGlvbicgJiYgIWRlc3Ryb3llZC5oYXMoaW5zdGFuY2UpKSB7XG4gICAgICAgICAgb25EZXN0cm95LmFwcGx5KGluc3RhbmNlKTtcbiAgICAgICAgICBkZXN0cm95ZWQuYWRkKGluc3RhbmNlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl19