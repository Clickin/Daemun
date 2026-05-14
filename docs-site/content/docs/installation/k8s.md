---
title: Kubernetes Installation
description: Install on Kubernetes
---

## Install with Kubernetes Manifests

If you don't want to use the unofficial Helm chart, you can also create your own Kubernetes manifest(s) and apply them with `kubectl apply -f filename.yaml`.

Here's a working example of the resources you need:

#### ServiceAccount

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: daemun
  namespace: default
  labels:
    app.kubernetes.io/name: daemun
secrets:
  - name: daemun
```

#### Secret

```yaml
apiVersion: v1
kind: Secret
type: kubernetes.io/service-account-token
metadata:
  name: daemun
  namespace: default
  labels:
    app.kubernetes.io/name: daemun
  annotations:
    kubernetes.io/service-account.name: daemun
```

#### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: daemun
  namespace: default
  labels:
    app.kubernetes.io/name: daemun
data:
  kubernetes.yaml: |
    mode: cluster
  settings.yaml: ""
  #settings.yaml: |
  #  providers:
  #    longhorn:
  #      url: https://longhorn.my.network
  custom.css: ""
  custom.js: ""
  bookmarks.yaml: |
    - Developer:
        - Github:
            - abbr: GH
              href: https://github.com/
  services.yaml: |
    - My First Group:
        - My First Service:
            href: http://localhost/
            description: Daemun is awesome

    - My Second Group:
        - My Second Service:
            href: http://localhost/
            description: Daemun is the best

    - My Third Group:
        - My Third Service:
            href: http://localhost/
            description: Daemun is 😎
  widgets.yaml: |
    - kubernetes:
        cluster:
          show: true
          cpu: true
          memory: true
          showLabel: true
          label: "cluster"
        nodes:
          show: true
          cpu: true
          memory: true
          showLabel: true
    - resources:
        backend: resources
        expanded: true
        cpu: true
        memory: true
        network: default
    - search:
        provider: duckduckgo
        target: _blank
  docker.yaml: ""
```

#### ClusterRole and ClusterRoleBinding

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: daemun
  labels:
    app.kubernetes.io/name: daemun
rules:
  - apiGroups:
      - ""
    resources:
      - namespaces
      - pods
      - nodes
    verbs:
      - get
      - list
  - apiGroups:
      - extensions
      - networking.k8s.io
    resources:
      - ingresses
    verbs:
      - get
      - list
  - apiGroups:
      - traefik.io
    resources:
      - ingressroutes
    verbs:
      - get
      - list
  - apiGroups:
      - gateway.networking.k8s.io
    resources:
      - httproutes
      - gateways
    verbs:
      - get
      - list
  - apiGroups:
      - metrics.k8s.io
    resources:
      - nodes
      - pods
    verbs:
      - get
      - list
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: daemun
  labels:
    app.kubernetes.io/name: daemun
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: daemun
subjects:
  - kind: ServiceAccount
    name: daemun
    namespace: default
```

#### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: daemun
  namespace: default
  labels:
    app.kubernetes.io/name: daemun
  annotations:
spec:
  type: ClusterIP
  ports:
    - port: 3000
      targetPort: http
      protocol: TCP
      name: http
  selector:
    app.kubernetes.io/name: daemun
```

#### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: daemun
  namespace: default
  labels:
    app.kubernetes.io/name: daemun
spec:
  revisionHistoryLimit: 3
  replicas: 1
  strategy:
    type: RollingUpdate
  selector:
    matchLabels:
      app.kubernetes.io/name: daemun
  template:
    metadata:
      labels:
        app.kubernetes.io/name: daemun
    spec:
      serviceAccountName: daemun
      automountServiceAccountToken: true
      dnsPolicy: ClusterFirst
      enableServiceLinks: true
      containers:
        - name: daemun
          image: "ghcr.io/clickin/daemun:latest"
          imagePullPolicy: Always
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
            runAsNonRoot: true
            runAsUser: 1000
            runAsGroup: 1000
            seccompProfile:
              type: RuntimeDefault
          env:
            - name: MY_POD_IP
              valueFrom:
                fieldRef:
                  fieldPath: status.podIP
            - name: HOMEPAGE_ALLOWED_HOSTS
              value: "$(MY_POD_IP):3000,daemun.example.com" # See the install overview. Value before the comma is required for the k8s probe
          ports:
            - name: http
              containerPort: 3000
              protocol: TCP
          livenessProbe:
            httpGet:
              path: /api/healthcheck
              port: http
            initialDelaySeconds: 5
            periodSeconds: 15
          volumeMounts:
            - mountPath: /app/config/custom.js
              name: daemun-config
              subPath: custom.js
            - mountPath: /app/config/custom.css
              name: daemun-config
              subPath: custom.css
            - mountPath: /app/config/bookmarks.yaml
              name: daemun-config
              subPath: bookmarks.yaml
            - mountPath: /app/config/docker.yaml
              name: daemun-config
              subPath: docker.yaml
            - mountPath: /app/config/kubernetes.yaml
              name: daemun-config
              subPath: kubernetes.yaml
            - mountPath: /app/config/services.yaml
              name: daemun-config
              subPath: services.yaml
            - mountPath: /app/config/settings.yaml
              name: daemun-config
              subPath: settings.yaml
            - mountPath: /app/config/widgets.yaml
              name: daemun-config
              subPath: widgets.yaml
            - mountPath: /app/config/logs
              name: logs
      volumes:
        - name: daemun-config
          configMap:
            name: daemun
        - name: logs
          emptyDir: {}
```

#### Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: daemun
  namespace: default
  labels:
    app.kubernetes.io/name: daemun
  annotations:
    gethomepage.dev/description: Dynamically Detected Daemun
    gethomepage.dev/enabled: "true"
    gethomepage.dev/group: Cluster Management
    gethomepage.dev/icon: daemun.png
    gethomepage.dev/name: Daemun
spec:
  rules:
    - host: "daemun.my.network"
      http:
        paths:
          - path: "/"
            pathType: Prefix
            backend:
              service:
                name: daemun
                port:
                  number: 3000
```

### Multiple Replicas

If you plan to deploy Daemun with a replica count greater than 1, you may
want to consider enabling sticky sessions on the Daemun route. This will
prevent unnecessary re-renders on page loads and window / tab focusing. The
procedure for enabling sticky sessions depends on your Ingress controller. Below
is an example using Traefik as the Ingress controller.

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: daemun.example.com
spec:
  entryPoints:
    - websecure
  routes:
    - kind: Rule
      match: Host(`daemun.example.com`)
      services:
        - kind: Service
          name: daemun
          port: 3000
          sticky:
            cookie:
              httpOnly: true
              secure: true
              sameSite: none
```
