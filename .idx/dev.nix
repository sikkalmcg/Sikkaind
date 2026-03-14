# To learn more about how to use Nix to configure your environment
# see: https://firebase.google.com/docs/studio/customize-workspace
{pkgs}: {
  # Which nixpkgs channel to use.
  channel = "stable-24.11"; # or "unstable"

  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.nodejs_20
    pkgs.pnpm
    pkgs.git-lfs   # <-- Bhai, LFS yahan add kar diya hai
  ];

  # Sets environment variables in the workspace
  env = {
    # Isse build ke waqt memory issues nahi aate
    NODE_OPTIONS = "--max-old-space-size=4096";
  };

  # This adds a file watcher to startup the firebase emulators.
  services.firebase.emulators = {
    # Disabling because we are using prod backends right now
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
      # Jab workspace pehli baar bane toh ye chale
      onCreate = {
        # LFS ko auto-initialize karne ke liye
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
          # Turbopack use kar rahe ho toh ye sahi command hai
          command = ["npm" "run" "dev" "--" "--port" "$PORT" "--hostname" "0.0.0.0"];
          manager = "web";
        };
      };
    };
  };
}