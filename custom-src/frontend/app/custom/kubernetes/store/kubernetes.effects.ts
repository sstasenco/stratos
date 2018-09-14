import { Injectable } from '@angular/core';
import { Headers, Http } from '@angular/http';
import { Actions, Effect } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, flatMap, mergeMap } from 'rxjs/operators';

import {
  kubernetesAppsSchemaKey,
  kubernetesDeploymentsSchemaKey,
  kubernetesNamespacesSchemaKey,
  kubernetesPodsSchemaKey,
  kubernetesServicesSchemaKey,
  kubernetesStatefulSetsSchemaKey,
} from '../../../../../../src/frontend/app/store/helpers/entity-factory';
import { environment } from '../../../../environments/environment';
import { AppState } from '../../../store/app-state';
import { kubernetesNodesSchemaKey } from '../../../store/helpers/entity-factory';
import { NormalizedResponse } from '../../../store/types/api.types';
import {
  StartRequestAction,
  WrapperRequestActionFailed,
  WrapperRequestActionSuccess,
} from '../../../store/types/request.types';
import {
  KubernetesConfigMap,
  KubernetesDeployment,
  KubernetesNamespace,
  KubernetesNode,
  KubernetesPod,
  KubernetesStatefuleSet,
  KubeService,
} from './kube.types';
import {
  GeKubernetesDeployments,
  GET_KUBE_DEPLOYMENT,
  GET_KUBE_POD,
  GET_KUBE_STATEFULSETS,
  GET_KUBERNETES_APP_INFO,
  GET_NAMESPACES_INFO,
  GET_NODE_INFO,
  GET_POD_INFO,
  GET_SERVICE_INFO,
  GetKubernetesApps,
  GetKubernetesNamespaces,
  GetKubernetesNodes,
  GetKubernetesPod,
  GetKubernetesPods,
  GetKubernetesServices,
  GetKubernetesStatefulSets,
  KubeAction,
} from './kubernetes.actions';

export type GetID<T> = (p: T)  => string;

@Injectable()
export class KubernetesEffects {
  proxyAPIVersion = environment.proxyAPIVersion;
  constructor(
    private http: Http,
    private actions$: Actions,
    private store: Store<AppState>
  ) { }

  @Effect()
  fetchNodeInfo$ = this.actions$.ofType<GetKubernetesNodes>(GET_NODE_INFO).pipe(
    flatMap(action => {
      const getUid: GetID<KubernetesNode> = (p) => p.metadata.uid;
      return this.processAction<KubernetesNode>(action,
        `/pp/${this.proxyAPIVersion}/proxy/api/v1/nodes`,
        kubernetesNodesSchemaKey,
          getUid);
    })
  );

  @Effect()
  fetchPodsInfo$ = this.actions$.ofType<GetKubernetesPods>(GET_POD_INFO).pipe(
    flatMap(action => {
      const getUid: GetID<KubernetesPod> = (p) => p.metadata.uid;
      return this.processAction<KubernetesPod>(action,
        `/pp/${this.proxyAPIVersion}/proxy/api/v1/pods`,
        kubernetesPodsSchemaKey,
          getUid);
    })
  );

  @Effect()
  fetchPodInfo$ = this.actions$.ofType<GetKubernetesPod>(GET_KUBE_POD).pipe(
    flatMap(action => {
      const getUid: GetID<KubernetesPod> = (p) => p.metadata.uid;
      return this.processAction<KubernetesPod>(action,
        `/pp/${this.proxyAPIVersion}/proxy/api/v1/namespaces/${action.namespaceName}/pods/${action.podName}`,
        kubernetesPodsSchemaKey,
          getUid);
    })
  );

  @Effect()
  fetchServicesInfo$ = this.actions$.ofType<GetKubernetesServices>(GET_SERVICE_INFO).pipe(
    flatMap(action => {

      const getUid: GetID<KubeService> = (p) => p.metadata.uid;
      return this.processAction<KubeService>(action,
        `/pp/${this.proxyAPIVersion}/proxy/api/v1/services`,
        kubernetesServicesSchemaKey,
          getUid);
    })
  );

  @Effect()
  fetchNamespaceInfo$ = this.actions$.ofType<GetKubernetesNamespaces>(GET_NAMESPACES_INFO).pipe(
    flatMap(action => {

      const getUid: GetID<KubernetesNamespace> = (p) => p.metadata.uid;
      return this.processAction<KubernetesNamespace>(action,
        `/pp/${this.proxyAPIVersion}/proxy/api/v1/namespaces`,
        kubernetesNamespacesSchemaKey,
          getUid);
    })

  );

  @Effect()
  fetchStatefulSets$ = this.actions$.ofType<GetKubernetesStatefulSets>(GET_KUBE_STATEFULSETS).pipe(
    flatMap(action => {

      const getUid: GetID<KubernetesStatefuleSet> = (p) => p.metadata.uid;
      return this.processAction<KubernetesStatefuleSet>(action,
        `/pp/${this.proxyAPIVersion}/proxy/apis/apps/v1/statefulsets`,
        kubernetesStatefulSetsSchemaKey,
          getUid);
    })
  );

  @Effect()
  fetchDeployments$ = this.actions$.ofType<GeKubernetesDeployments>(GET_KUBE_DEPLOYMENT).pipe(
    flatMap(action => {

      const getUid: GetID<KubernetesDeployment> = (p) => p.metadata.uid;
      return this.processAction<KubernetesDeployment>(action,
         `/pp/${this.proxyAPIVersion}/proxy/apis/apps/v1/deployments`,
          kubernetesDeploymentsSchemaKey,
          getUid);
    })
  );

  @Effect()
  fetchKubernetesAppsInfo$ = this.actions$.ofType<GetKubernetesApps>(GET_KUBERNETES_APP_INFO).pipe(
    flatMap(action => {
      this.store.dispatch(new StartRequestAction(action));
      const headers = new Headers({ 'x-cap-cnsi-list': action.kubeGuid });
      const requestArgs = {
        headers: headers
      };
      return this.http
        .get(`/pp/${this.proxyAPIVersion}/proxy/api/v1/configmaps`, requestArgs)
        .pipe(
          mergeMap(response => {
            const info = response.json();
            const mappedData = {
              entities: { [kubernetesAppsSchemaKey]: {} },
              result: []
            } as NormalizedResponse;

            const id = action.kubeGuid;
            console.log(info[id].items);
            const releases = info[id].items
              .filter((configMap) => !!configMap.metadata.labels &&
                !!configMap.metadata.labels['NAME'] &&
                configMap.metadata.labels['OWNER'] === 'TILLER')
              .map((configMap: KubernetesConfigMap) => ({
                name: configMap.metadata.labels['NAME'],
                kubeId: action.kubeGuid,
                createdAt: configMap.metadata.creationTimestamp,
                status:  configMap.metadata.labels['STATUS'],
                version:  configMap.metadata.labels['VERSION']
              })
              );
            // const appReleases = releases.map((relaseObj) => (
            //   {
            //     name: relaseObj.name,
            //     kubeId: action.kubeGuid,
            //     namespace: relaseObj.namespace,
            //   })
            // );

            releases.forEach(r => {
              const _id = `${r.kubeId}-${r.name}`;
              mappedData.entities[kubernetesAppsSchemaKey][_id] = r;
              if (mappedData.result.indexOf(_id) === -1) {
                mappedData.result.push(_id);
              }
            });
            return [
              new WrapperRequestActionSuccess(mappedData, action)
            ];
          }),
          catchError(err => [
            new WrapperRequestActionFailed(err.message, action)
          ])
        );
    })
  );

  private processAction<T>(action: KubeAction, url: string, schemaKey: string, getId: GetID<T> ) {
    this.store.dispatch(new StartRequestAction(action));
    const headers = new Headers({ 'x-cap-cnsi-list': action.kubeGuid });
    const requestArgs = {
      headers: headers
    };
    return this.http
      .get(url, requestArgs)
      .pipe(mergeMap(response => {
        const info = response.json();
        const mappedData = {
          entities: { [schemaKey]: {} },
          result: []
        } as NormalizedResponse;
        info[action.kubeGuid].items.forEach((p: T) => {
          const id = getId(p);
          mappedData.entities[schemaKey][id] = p;
          mappedData.result.push(id);
        });
        return [
          new WrapperRequestActionSuccess(mappedData, action)
        ];
      }), catchError(err => [
        new WrapperRequestActionFailed(err.message, action)
      ]));
  }
}
