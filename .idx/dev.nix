# To learn more about how to use Nix to configure your environment
# see: https://firebase.google.com/docs/studio/customize-workspace
{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "unstable"; # or "stable-23.11"

  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.nodejs_20
    pkgs.pnpm
    pkgs.git-lfs
    pkgs.sudo
  ];

  # Sets environment variables in the workspace
  env = {
    NODE_OPTIONS = "--max-old-space-size=4096";
  };

  # This adds a file watcher to startup the firebase emulators.
  services.firebase.emulators = {
    detect = false;
    projectId = "demo-app";
    services = ["auth" "firestore"];
  };

  idx = {
    # Search for the extensions you want on https://open-vsx.org/
    extensions = [
      "christian-kohler.path-intellisense"
      "esbenp.prettier-vscode"
    ];

    workspace = {
      onCreate = {
        init-lfs = "git lfs install";
        default.openFiles = [
          "src/app/page.tsx"
        ];
      };
    };

    # Enable previews and customize configuration
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["npm" "run" "dev" "--" "--port" "$PORT" "--hostname" "0.0.0.0"];
          manager = "web";
        };
      };
    };
  };
}
