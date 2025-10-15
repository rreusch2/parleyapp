#!/usr/bin/env python3
"""
Simple Playwright API for Agent Builder Function calls
"""
from flask import Flask, request, jsonify
from playwright.sync_api import sync_playwright
import json
import sys

app = Flask(__name__)

@app.route('/browse', methods=['POST'])
def browse():
    try:
        data = request.json
        action = data.get('action')
        url = data.get('url')
        selector = data.get('selector')
        
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            
            if action == 'navigate':
                page.goto(url)
                title = page.title()
                browser.close()
                return jsonify({
                    "success": True,
                    "title": title,
                    "url": url
                })
                
            elif action == 'screenshot':
                page.goto(url)
                screenshot = page.screenshot(full_page=True)
                browser.close()
                return jsonify({
                    "success": True,
                    "screenshot_taken": True,
                    "url": url
                })
                
            elif action == 'extract_text':
                page.goto(url)
                if selector:
                    text = page.locator(selector).text_content()
                else:
                    text = page.text_content()
                browser.close()
                return jsonify({
                    "success": True,
                    "text": text[:2000],  # Limit text length
                    "url": url
                })
                
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5555)
