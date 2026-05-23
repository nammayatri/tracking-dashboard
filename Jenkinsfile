pipeline {
    agent {
        kubernetes {
            label 'dind-agent'
        }
    }

    environment {
        AWS_REGION  = 'ap-south-1'
        ACCOUNT_ID  = '463356420488'   // UAT
        ACCOUNT_ID2 = '147728078333'   // PROD (reference; not pushed to from this pipeline)
    }

    parameters {
        extendedChoice(
            name: 'COMPONENTS',
            description: 'Select one or more components to build & push',
            type: 'PT_CHECKBOX',
            value: 'backend,frontend,frontend-minimal',
            defaultValue: 'frontend-minimal',
            visibleItemCount: 3,
            multiSelectDelimiter: ','
        )
    }

    stages {
        stage('Initialize') {
            steps {
                script {
                    env.LAST_COMMIT_HASH = sh(script: "git rev-parse HEAD", returnStdout: true).trim().substring(0, 6)
                    env.SELECTED = (params.COMPONENTS ?: '').trim()
                    echo "Building components: ${env.SELECTED}"
                    echo "Commit: ${env.LAST_COMMIT_HASH}"
                }
            }
        }

        stage('backend') {
            when { expression { env.SELECTED.tokenize(',').contains('backend') } }
            steps {
                script {
                    env.IMAGE_NAME = 'tracking-debug-backend-master'
                    dir('backend') {
                        withCredentials([string(credentialsId: 'pk_docker_hub', variable: 'DOCKER_PASSWORD')]) {
                            sh "docker version"
                            sh "docker build -t ${env.IMAGE_NAME}:latest ."

                            // Push to UAT ECR
                            sh "aws ecr get-login-password --region ${env.AWS_REGION} | docker login --username AWS --password-stdin ${env.ACCOUNT_ID}.dkr.ecr.${env.AWS_REGION}.amazonaws.com"
                            sh "docker tag ${env.IMAGE_NAME}:latest ${env.ACCOUNT_ID}.dkr.ecr.${env.AWS_REGION}.amazonaws.com/${env.IMAGE_NAME}:${env.LAST_COMMIT_HASH}"
                            sh "docker push ${env.ACCOUNT_ID}.dkr.ecr.${env.AWS_REGION}.amazonaws.com/${env.IMAGE_NAME}:${env.LAST_COMMIT_HASH}"
                        }
                    }
                }
            }
        }

        stage('frontend') {
            when { expression { env.SELECTED.tokenize(',').contains('frontend') } }
            steps {
                script {
                    env.IMAGE_NAME = 'tracking-debug-frontend-master'
                    dir('frontend') {
                        withCredentials([string(credentialsId: 'pk_docker_hub', variable: 'DOCKER_PASSWORD')]) {
                            sh "docker version"
                            sh """
                                docker build \\
                                  --build-arg VITE_API_URL=https://api.sandbox.moving.tech/tracking-debug-api \\
                                  --build-arg VITE_BASE_URL=https://api.sandbox.moving.tech/tracking-debug-api \\
                                  -t ${env.IMAGE_NAME}:latest .
                            """

                            sh "aws ecr get-login-password --region ${env.AWS_REGION} | docker login --username AWS --password-stdin ${env.ACCOUNT_ID}.dkr.ecr.${env.AWS_REGION}.amazonaws.com"
                            sh "docker tag ${env.IMAGE_NAME}:latest ${env.ACCOUNT_ID}.dkr.ecr.${env.AWS_REGION}.amazonaws.com/${env.IMAGE_NAME}:${env.LAST_COMMIT_HASH}"
                            sh "docker push ${env.ACCOUNT_ID}.dkr.ecr.${env.AWS_REGION}.amazonaws.com/${env.IMAGE_NAME}:${env.LAST_COMMIT_HASH}"
                        }
                    }
                }
            }
        }

        stage('frontend-minimal') {
            when { expression { env.SELECTED.tokenize(',').contains('frontend-minimal') } }
            steps {
                script {
                    env.IMAGE_NAME = 'tracking-debug-frontend-minimal-master'
                    dir('frontend-minimal') {
                        withCredentials([string(credentialsId: 'pk_docker_hub', variable: 'DOCKER_PASSWORD')]) {
                            sh "docker version"
                            sh """
                                docker build \\
                                  --build-arg REACT_APP_API_BASE_URL=https://api.sandbox.moving.tech/tracking-debug-api \\
                                  -t ${env.IMAGE_NAME}:latest .
                            """

                            sh "aws ecr get-login-password --region ${env.AWS_REGION} | docker login --username AWS --password-stdin ${env.ACCOUNT_ID}.dkr.ecr.${env.AWS_REGION}.amazonaws.com"
                            sh "docker tag ${env.IMAGE_NAME}:latest ${env.ACCOUNT_ID}.dkr.ecr.${env.AWS_REGION}.amazonaws.com/${env.IMAGE_NAME}:${env.LAST_COMMIT_HASH}"
                            sh "docker push ${env.ACCOUNT_ID}.dkr.ecr.${env.AWS_REGION}.amazonaws.com/${env.IMAGE_NAME}:${env.LAST_COMMIT_HASH}"
                        }
                    }
                }
            }
        }
    }

    post {
        always {
            sh 'docker image ls || true'
        }
    }
}
