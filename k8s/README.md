# Kubernetes Deployment for Namma Yatri Application

This directory contains Kubernetes configuration files for deploying the Namma Yatri application in the `atlas` namespace.

## Structure

- `frontend-deployment.yaml` - Deployment for the React frontend
- `frontend-service.yaml` - Service for the frontend
- `backend-deployment.yaml` - Deployment for the Node.js backend
- `backend-service.yaml` - Service for the backend
- `ingress.yaml` - Ingress for routing external traffic
- `config.yaml` - ConfigMap for application configuration
- `secrets.yaml` - Secrets for sensitive data
- `kustomization.yaml` - Kustomize configuration for managing all resources

## Environment Variables

### Frontend Environment Variables
- `NODE_ENV` - Node environment (production, development)
- `VITE_API_URL` - API URL for backend endpoints
- `VITE_BASE_URL` - Base URL for the application

### Backend Environment Variables
- `NODE_ENV` - Node environment
- `PORT` - Port for the backend server

## Deployment

### Prerequisites
- Kubernetes cluster with access configured via `kubectl`
- Namespace `atlas` created
- Docker images pushed to the container registry

### Update Image References
Before deployment, update the image references in the deployment files or the kustomization.yaml file to point to your actual repository:

```yaml
images:
- name: ghcr.io/your-username/your-repo-name-frontend
  newTag: latest
- name: ghcr.io/your-username/your-repo-name-backend
  newTag: latest
```

### Configure Environment Variables
Update the environment variables in `config.yaml` and encode secrets for `secrets.yaml`:

```bash
echo -n "your-secret" | base64
```

### Deploy
To deploy the entire application:

```bash
kubectl apply -k .
```

Or apply individual resources:

```bash
kubectl apply -f frontend-deployment.yaml
kubectl apply -f frontend-service.yaml
# etc.
```

### Accessing the Application
The application will be available at the host specified in the Ingress configuration (e.g., app.example.com).

## Updating Configuration
To update the configuration:

1. Modify the ConfigMap or Secret
2. Apply the changes:
   ```bash
   kubectl apply -f config.yaml
   ```
3. Restart the deployments to pick up new config:
   ```bash
   kubectl rollout restart deployment frontend
   kubectl rollout restart deployment backend
   ``` 