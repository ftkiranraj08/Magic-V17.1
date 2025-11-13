#!/usr/bin/env python3
"""
Script to comment out all remaining strength menus in dial.html
"""

import re

def comment_strength_menus(filename):
    """Comment out all uncommented strength menu blocks"""
    with open(filename, 'r') as f:
        content = f.read()
    
    # Pattern to match uncommented strength menu blocks
    pattern = r'(\s*)<div class="strength-menu">\s*\n((?:.*\n)*?)\s*</div>'
    
    def replacement(match):
        indent = match.group(1)
        menu_content = match.group(2)
        return f'''{indent}<!-- Strength menu commented out - using dynamic parameters instead -->
{indent}<!--
{indent}<div class="strength-menu">
{menu_content}{indent}</div>
{indent}-->'''
    
    # Replace all matches
    new_content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
    
    # Write back to file
    with open(filename, 'w') as f:
        f.write(new_content)
    
    print(f"Successfully commented out strength menus in {filename}")

if __name__ == "__main__":
    comment_strength_menus("templates/dial.html")