# Release

`@rmrdeveloper/sideroom-dsh` is released with [Changesets](https://github.com/changesets/changesets)
and published by GitHub Actions through npm trusted publishing (OIDC). No npm token is stored in the
repository.

## The path a release takes

1. A pull request changes the package and adds a changeset:

   ```bash
   npm run changeset
   ```

   Pick `patch`, `minor`, or `major` and write the summary the changelog will show.

2. Merge the pull request into `main`. The `Release` workflow runs in `version` mode and opens (or
   updates) a **Version Packages** pull request that bumps `package.json` and appends `CHANGELOG.md`.

3. Merge the **Version Packages** pull request. The workflow now runs in `publish` mode, packs the
   workspace, publishes with provenance, pushes the `vX.Y.Z` tag, and creates the GitHub release.

## One-time setup

### First publish is manual

The registry only accepts a trusted-publisher configuration for a package that already exists, so the
first version goes out from a machine with publish rights on the `@rmrdeveloper` scope:

```bash
npm login
npm whoami                      # must print the account that owns @rmrdeveloper
npm install                     # dev dependencies for the build and the artifact check
npm run check                   # builds, tests, and verifies the packed tarball
npm publish                     # runs prepublishOnly -> npm run check
git tag v0.1.0
git push origin v0.1.0
```

`npm publish` refuses a `private` package and a scoped package without `publishConfig.access: "public"`;
both are set.

### Trusted publisher for CI

Once the package exists, point npm at this repository. Either use the CLI (npm `>= 11.15.0`, 2FA
enabled on the account):

```bash
npm trust github @rmrdeveloper/sideroom-dsh \
  --file release.yml \
  --repo RMRdeveloper/sideroom-dsh \
  --env npm \
  --allow-publish
```

or on npmjs.com: **package → Settings → Trusted Publisher → GitHub Actions**, with organization or
user `RMRdeveloper`, repository `sideroom-dsh`, workflow filename `release.yml`, environment `npm`.

Create the `npm` environment under **GitHub → Settings → Environments**. The publish job declares it, so
required reviewers on that environment gate every release.

The publish job needs `id-token: write`, which `release.yml` already grants. Provenance is emitted
automatically for trusted publishing.

## What the harness enforces at install time

- `engines.dsh` alone decides whether a DSH installation admits the bundle. It is currently
  `>=0.2.2-rc.1 <0.3.0-0`, and prereleases participate in matching. Widen it only after testing the
  harness APIs this port uses (`tools/pre-execute`, `tools/post-execute`, `agent/pre-step`,
  `systemPrompt.section`, and the `skills` service).
- The package must declare `dsh.bundle.patch`; the Plugin manager refuses a package that declares none.
- `files` decides the tarball. `npm run check:pack` fails when the packed artifact loses the entry
  point, the patch, the locales, the icon, or any guideline and skill asset, and loads the entry point
  from an extracted tarball.

## Verifying a release

```bash
npm view @rmrdeveloper/sideroom-dsh version dist-tags
npm view @rmrdeveloper/sideroom-dsh dist.attestations
```

Then install it in the app: **Plugins → Add plugin → `@rmrdeveloper/sideroom-dsh`**.

## If something goes wrong

- `E401`/`E403` on publish: the local session is not logged in or lacks write access; re-run
  `npm login`. A trusted publisher that already exists refuses a second one; use `npm trust list` and
  `npm trust revoke --id <id>`.
- The registry keeps every version. A bad release is fixed with a new patch version, not by moving a
  tag. `npm unpublish` is only possible within 72 hours of publication.
- A version that does not match the running DSH is refused at install with `incompatible-version`.
  The remedy is an exact-version exemption in the profile's `compatibility.json`, through
  `plugin_manager` `set_version_exemption` or `dsh plugin allow-version`; grant it only after
  accepting the risk.
