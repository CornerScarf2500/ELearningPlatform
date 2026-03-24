import os

REPO_PATH = r"D:\ELearningPlatform"
OUTPUT_FILE = os.path.join(REPO_PATH, "project_code_for_ai.txt")
SCRIPT_NAME = os.path.basename(__file__)

# Ignored folders and files
IGNORE_DIRS = {'.git', '__pycache__', 'node_modules', 'venv', 'env', '.idea', '.vscode', 'dist', 'build', '.next', 'coverage'}
IGNORE_FILES = {'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'project_code_for_ai.txt', 'Gather.py', SCRIPT_NAME}

# Added .tsx, .ts, and .jsx so we can see your React Frontend! Added .json for package.json
ALLOWED_EXTENSIONS = {'.py', '.html', '.css', '.js', '.jsx', '.ts', '.tsx', '.md', '.txt', '.json'}

def gather_code():
    if not os.path.exists(REPO_PATH):
        print(f"Error: The folder {REPO_PATH} does not exist!")
        return

    print(f"Scanning {REPO_PATH}...\n")
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as outfile:
        outfile.write("=== E-LEARNING PLATFORM PROJECT FILES ===\n\n")
        
        for root, dirs, files in os.walk(REPO_PATH):
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
            
            for file in files:
                if file in IGNORE_FILES:
                    continue
                    
                ext = os.path.splitext(file)[1].lower()
                if ext in ALLOWED_EXTENSIONS:
                    filepath = os.path.join(root, file)
                    relative_path = os.path.relpath(filepath, REPO_PATH)
                    
                    try:
                        with open(filepath, 'r', encoding='utf-8') as infile:
                            content = infile.read()
                            
                        outfile.write(f"--- START OF FILE: {relative_path} ---\n")
                        outfile.write(content)
                        outfile.write(f"\n--- END OF FILE: {relative_path} ---\n\n")
                        print(f"Successfully read: {relative_path}")
                        
                    except Exception as e:
                        print(f"Could not read {relative_path}: {e}")

    print(f"\nDone! All your code has been saved into:")
    print(OUTPUT_FILE)

if __name__ == "__main__":
    gather_code()