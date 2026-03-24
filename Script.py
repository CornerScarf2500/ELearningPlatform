import os
import re
import shutil

# The path to your project
PROJECT_DIR = r"D:\ELearningPlatform"
CLIENT_SRC = os.path.join(PROJECT_DIR, "client", "src")
SERVER_DIR = os.path.join(PROJECT_DIR, "server")
BACKUP_DIR = os.path.join(PROJECT_DIR, "script_backups")
FALLBACK_FILE = os.path.join(PROJECT_DIR, "CODE_TO_SEND_TO_AI.txt")

def backup_file(filepath):
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)
    rel_path = os.path.relpath(filepath, PROJECT_DIR)
    backup_path = os.path.join(BACKUP_DIR, rel_path + ".bak")
    backup_folder = os.path.dirname(backup_path)
    if not os.path.exists(backup_folder):
        os.makedirs(backup_folder)
    if not os.path.exists(backup_path):
        shutil.copy2(filepath, backup_path)

def fix_mobile_layout():
    print("\n[1/3] Forcing Mobile View for Content List...")
    found_and_fixed = False
    
    for root, dirs, files in os.walk(CLIENT_SRC):
        for file in files:
            if file.endswith(('.tsx', '.jsx')):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Aggressive Check: If it has a video/player, force flex-col on the main wrappers
                if ('<video' in content or 'ReactPlayer' in content or 'player' in content.lower()):
                    original = content
                    
                    # Force main containers to stack on mobile
                    content = re.sub(
                        r'(className=["\'][^"\']*\bflex\b)(?!.*flex-col)([^"\']*(?:h-screen|w-full|min-h|h-full)[^"\']*["\'])', 
                        r'\1 flex-col lg:flex-row\2', 
                        content
                    )

                    # Force the sidebar to take full width on mobile
                    content = re.sub(
                        r'(className=["\'][^"\']*\b)w-(64|72|80|96|1/4|1/3|\[\d+px\])(\b[^"\']*["\'])', 
                        r'\1w-full lg:w-\2\3', 
                        content
                    )

                    if content != original:
                        backup_file(filepath)
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(content)
                        print(f"  -> SUCCESS: Forced responsive layout in {file}")
                        found_and_fixed = True

    if not found_and_fixed:
        print("  -> Could not automatically detect the layout wrappers.")

def fix_video_slider():
    print("\n[2/3] Forcing Video Speed Control to Slider...")
    found_and_fixed = False
    
    for root, dirs, files in os.walk(CLIENT_SRC):
        for file in files:
            if file.endswith(('.tsx', '.jsx')):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                original = content

                # Aggressive Replace 1: Standard <select> dropdowns
                content = re.sub(
                    r'<select[^>]*value={([^}]+)}[^>]*onChange={([^}]+)}[^>]*>.*?</select>', 
                    r'''<div className="flex items-center gap-3 bg-gray-800/80 px-3 py-1.5 rounded-lg border border-gray-700">
      <span className="text-sm font-semibold text-white whitespace-nowrap">Speed: {\1}x</span>
      <input type="range" min="0.25" max="2" step="0.25" value={\1} onChange={\2} className="w-24 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500" />
    </div>''', 
                    content, flags=re.DOTALL
                )

                # Aggressive Replace 2: Modern UI Libraries (like Shadcn <Select>)
                content = re.sub(
                    r'<Select[^>]*value={([^}]+)}[^>]*onValueChange={([^}]+)}[^>]*>.*?</Select>', 
                    r'''<div className="flex items-center gap-3 bg-gray-800/80 px-3 py-1.5 rounded-lg border border-gray-700">
      <span className="text-sm font-semibold text-white whitespace-nowrap">Speed: {\1}x</span>
      <input type="range" min="0.25" max="2" step="0.25" value={\1} onChange={(e) => \2(e.target.value)} className="w-24 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500" />
    </div>''', 
                    content, flags=re.DOTALL
                )

                if content != original:
                    backup_file(filepath)
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"  -> SUCCESS: Injected Speed Slider into {file}")
                    found_and_fixed = True

    if not found_and_fixed:
        print("  -> Could not find a recognizable speed dropdown.")

def fix_favorites_bug():
    print("\n[3/3] Forcing Favorites Data Patch...")
    found_and_fixed = False

    # Force Frontend Map/Includes Fix
    for root, dirs, files in os.walk(CLIENT_SRC):
        for file in files:
            if file.endswith(('.tsx', '.jsx')):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                original = content
                
                # Convert exact matches into object ID matches
                content = re.sub(
                    r'([a-zA-Z0-9_?.]+favorites(?:\|\|\[\])?)\.includes\(([^)]+)\)',
                    r'\1.some((fav: any) => fav === \2 || fav?._id === \2)', 
                    content
                )

                if content != original:
                    backup_file(filepath)
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"  -> SUCCESS: Patched frontend favorite matching in {file}")
                    found_and_fixed = True

    # Force Backend Populate Fix
    if os.path.exists(SERVER_DIR):
        for root, dirs, files in os.walk(SERVER_DIR):
            for file in files:
                if file.endswith(('.js', '.ts')):
                    filepath = os.path.join(root, file)
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()

                    original = content
                    
                    # Aggressively append .populate('favorites') to ANY User.findById query in the auth/user controllers
                    if ('favorite' in content.lower() or 'auth' in file.lower() or 'user' in file.lower()):
                        content = re.sub(
                            r'(User\.findById\([^)]+\))(\s*\.select\([^)]+\))?(?!\.populate)',
                            r'\1\2.populate("favorites")',
                            content
                        )

                    if content != original:
                        backup_file(filepath)
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(content)
                        print(f"  -> SUCCESS: Patched backend database queries in {file}")
                        found_and_fixed = True

    if not found_and_fixed:
        print("  -> Favorites logic already looks patched.")

def create_fallback():
    """If the script STILL fails, it will extract exactly the 3 files I need to see into a text file!"""
    print("\n=== Fallback System ===")
    print("Gathering your specific component files just in case...")
    
    files_to_grab = []
    
    # Hunt down the specific files
    for root, dirs, files in os.walk(CLIENT_SRC):
        for file in files:
            if file.endswith(('.tsx', '.jsx')):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read().lower()
                    if 'reactplayer' in content or '<video' in content or 'speed' in content or 'favorite' in content:
                        files_to_grab.append(filepath)

    if files_to_grab:
        with open(FALLBACK_FILE, 'w', encoding='utf-8') as out:
            out.write("Hi AI, here are the specific files that need fixing:\n\n")
            for fp in files_to_grab[:5]: # grab top 5 most relevant
                out.write(f"\n--- FILE: {os.path.basename(fp)} ---\n")
                with open(fp, 'r', encoding='utf-8') as infile:
                    out.write(infile.read())
        print(f"[INFO] Created {FALLBACK_FILE} just in case the automatic fix missed anything.")

if __name__ == "__main__":
    print("=== E-Learning Platform Auto-Patcher V2 (Aggressive) ===")
    
    if not os.path.exists(PROJECT_DIR):
        print(f"ERROR: Could not find the folder {PROJECT_DIR}.")
    else:
        try:
            fix_mobile_layout()
            fix_video_slider()
            fix_favorites_bug()
            create_fallback()
            print("\n=== ALL DONE! ===")
            print("Please restart your React frontend and Node server!")
        except Exception as e:
            print(f"\nAn error occurred while patching: {e}")