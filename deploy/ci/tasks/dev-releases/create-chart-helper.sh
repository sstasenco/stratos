#!/bin/bash

patchHelmChart () {
  local TAG=$1
  local DOCKER_ORG=$2
  local DOCKER_REG=$3
  local CHART_PATH=$4
  local CHART_VERSION=$5
  local APP_VERSION=$6
  sed -i -e 's/consoleVersion: latest/consoleVersion: '"${TAG}"'/g' ${CHART_PATH}/values.yaml
  sed -i -e 's/organization: splatform/organization: '"${DOCKER_ORG}"'/g' ${CHART_PATH}/values.yaml
  sed -i -e 's/hostname: docker.io/hostname: '"${DOCKER_REG}"'/g' ${CHART_PATH}/values.yaml

  sed -i -e 's/version: 0.1.0/version: '"${CHART_VERSION}"'/g' ${CHART_PATH}/Chart.yaml  
  sed -i -e 's/appVersion: 0.1.0/appVersion: '"${APP_VERSION}"'/g' ${CHART_PATH}/Chart.yaml  
}

patchHelmChartDev () {
  local TAG=$1
  local DOCKER_ORG=$2
  local DOCKER_REG=$3
  local CHART_PATH=$4
  local CHART_VERSION=$5
  local APP_VERSION=$6
  patchHelmChart ${TAG} ${DOCKER_ORG} ${DOCKER_REG} ${CHART_PATH} ${CHART_VERSION} ${APP_VERSION}

  sed -i -e 's/imagePullPolicy: IfNotPresent/imagePullPolicy: Always/g' ${CHART_PATH}/values.yaml  
}

setupAndPushChange() {
  setupGitConfig
  git stash
  git pull --rebase
  git stash pop
  echo -e "Host github.com\n\tStrictHostKeyChecking no\n" >> ~/.ssh/config
  git add index.yaml
  git commit -m "Helm repository updated for tag: ${IMAGE_TAG}"
  git config --global push.default simple
  git push origin HEAD:${HELM_REPO_BRANCH}

}

setupGitConfig() {
  git config --global user.name ${GIT_USER}
  git config --global user.email ${GIT_EMAIL}

  mkdir -p /root/.ssh/
  echo "${GIT_PRIVATE_KEY}" > /root/.ssh/id_rsa
  chmod 600 /root/.ssh/id_rsa
}

updateHelmDependency() {
  local START_CWD=$(pwd)
  cd ${STRATOS}/deploy/kubernetes/console
  # Only do this if there is a requirements.yaml file
  if [ -f "./requirements.yaml" ]; then
    # Extract helm repo
    local HELM_REPO=$(cat requirements.yaml | grep repo | sed -e 's/.*repository:\s\(.*\)/\1/p' | head -1)
    helm repo add repo ${HELM_REPO}
    helm dependency update
  fi
  cd ${START_CWD}
}

fetchImageTag() {
  echo "$(cat ${STRATOS}/deploy/ci/tasks/dev-releases/nightly-tag)-$(git rev-parse HEAD | head -c 8)"
}

nightlyTag() {
  echo "$(cat ${STRATOS}/deploy/ci/tasks/dev-releases/nightly-tag)"
}
