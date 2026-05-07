#!/usr/bin/env bash
set -e
VERSION=$1
[ -z "$VERSION" ] && echo "Usage: $0 <version>" && exit 1
npm version "$VERSION" --workspace=packages/cubify --no-git-tag-version
npm version "$VERSION" --workspace=packages/cubify-react --no-git-tag-version
git add packages/cubify/package.json packages/cubify-react/package.json
git commit -m "chore: release v$VERSION"
git tag "v$VERSION"
echo "Tagged v$VERSION — push with: git push && git push --tags"
