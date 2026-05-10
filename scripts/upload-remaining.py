#!/usr/bin/env python3
"""Upload remaining images with accented filenames to Supabase Storage"""

import os
import sys
import unicodedata
import urllib.request
import urllib.parse
import json
import ssl

SUPABASE_URL = 'https://vqrjlwnooaxahidjjyru.supabase.co'
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')
DATABASE_URL = os.environ.get('DATABASE_URL', '')
IMAGES_DIR = os.path.join(os.path.dirname(__file__), '../../extracted/Pharmacie-Beauty/attached_assets/generated_images')
BUCKET_NAME = 'product-images'

def normalize_filename(filename):
    """Remove accents and special chars from filename"""
    # Decompose unicode, remove combining marks
    nfkd = unicodedata.normalize('NFKD', filename)
    ascii_name = nfkd.encode('ASCII', 'ignore').decode('ASCII')
    # Replace + with _plus_
    ascii_name = ascii_name.replace('+', '_plus_')
    # Replace any remaining non-alphanumeric (except . _ -) with _
    result = ''
    for c in ascii_name:
        if c.isalnum() or c in '._-':
            result += c
        else:
            result += '_'
    return result

def upload_file(filepath, storage_name, service_key):
    """Upload file to Supabase Storage"""
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{urllib.parse.quote(storage_name)}"

    with open(filepath, 'rb') as f:
        data = f.read()

    req = urllib.request.Request(url, data=data, method='POST')
    req.add_header('Authorization', f'Bearer {service_key}')
    req.add_header('Content-Type', 'image/png')
    req.add_header('x-upsert', 'true')

    ctx = ssl.create_default_context()

    try:
        resp = urllib.request.urlopen(req, context=ctx)
        return True, None
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return False, body

def update_db(old_path, new_url):
    """Update database using Supabase REST API"""
    url = f"{SUPABASE_URL}/rest/v1/products?image_url=eq.{urllib.parse.quote(old_path, safe='')}"

    data = json.dumps({'image_url': new_url}).encode()

    req = urllib.request.Request(url, data=data, method='PATCH')
    req.add_header('Authorization', f'Bearer {SUPABASE_SERVICE_KEY}')
    req.add_header('apikey', SUPABASE_SERVICE_KEY)
    req.add_header('Content-Type', 'application/json')
    req.add_header('Prefer', 'return=minimal')

    ctx = ssl.create_default_context()

    try:
        resp = urllib.request.urlopen(req, context=ctx)
        return True
    except Exception as e:
        return False

def main():
    print("🖼️  Uploading images with special characters...\n")

    if not SUPABASE_SERVICE_KEY:
        print("❌ SUPABASE_SERVICE_KEY required")
        sys.exit(1)

    # Find all files with non-ASCII chars in filename
    all_files = os.listdir(IMAGES_DIR)
    problem_files = [f for f in all_files if f != unicodedata.normalize('NFKD', f).encode('ASCII', 'ignore').decode('ASCII') or '+' in f]

    print(f"Found {len(problem_files)} files with special characters\n")

    uploaded = 0
    failed = 0

    for filename in sorted(problem_files):
        filepath = os.path.join(IMAGES_DIR, filename)
        normalized = normalize_filename(filename)
        old_path = f'/attached_assets/generated_images/{filename}'

        success, err = upload_file(filepath, normalized, SUPABASE_SERVICE_KEY)

        if success:
            public_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/{urllib.parse.quote(normalized)}"

            if update_db(old_path, public_url):
                print(f"  ✅ {filename} → {normalized}")
                uploaded += 1
            else:
                print(f"  ⚠️  Uploaded but DB update failed: {filename}")
                uploaded += 1
        else:
            print(f"  ❌ {filename}: {err}")
            failed += 1

    print(f"\n🎉 Done! {uploaded} uploaded, {failed} failed")

if __name__ == '__main__':
    main()
