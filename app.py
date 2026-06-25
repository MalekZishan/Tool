import re
import socket
import smtplib
import logging
import dns.resolver
from flask import Flask, request, jsonify, render_template
from playwright.sync_api import sync_playwright
from playwright_stealth import stealth_sync

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, template_folder='templates', static_folder='static')



# Curated list of common disposable email domains
DISPOSABLE_DOMAINS = {
    "mailinator.com", "10minutemail.com", "yopmail.com", "tempmail.com", 
    "dispostable.com", "getairmail.com", "guerrillamail.com", "sharklasers.com", 
    "burnermail.io", "trashmail.com", "temp-mail.org", "maildrop.cc", 
    "getnada.com", "tempmailaddress.com", "throwawaymail.com"
}

# Major providers list to prevent blocked local SMTP handshake checks
MAJOR_PROVIDERS = {"gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com"}
MAJOR_MX_KEYWORDS = {"google.com", "googlemail.com", "outlook.com", "protection.outlook.com", "yahoodns.net", "mimecast.com", "pphosted.com"}

def validate_syntax(email):
    """Checks if the email matches a robust RFC-compliant regular expression."""
    # Standard email format regex
    regex = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return re.match(regex, email) is not None

def check_disposable(domain):
    """Checks if the domain belongs to a known temporary/disposable email provider."""
    return domain.lower() in DISPOSABLE_DOMAINS

def resolve_mx_records(domain):
    """
    Resolves MX records for a domain.
    Returns (mx_hosts, has_mx, domain_exists)
    """
    try:
        answers = dns.resolver.resolve(domain, 'MX')
        # Sort by preference/priority value
        mx_hosts = [str(rdata.exchange).rstrip('.') for rdata in sorted(answers, key=lambda x: x.preference)]
        return mx_hosts, True, True
    except dns.resolver.NXDOMAIN:
        # Domain does not exist at DNS level
        return [], False, False
    except (dns.resolver.NoAnswer, dns.resolver.NoNameservers):
        # Domain exists, but might only have an A record (acts as a fallback mail server sometimes)
        try:
            dns.resolver.resolve(domain, 'A')
            return [], False, True
        except Exception:
            return [], False, False
    except Exception as e:
        logger.error(f"DNS MX resolution failed for {domain}: {str(e)}")
        return [], False, False

def check_mailbox_existence_smtp(email, mx_hosts):
    """
    Tries to perform SMTP handshake verification on the MX servers.
    Returns (status, reason, exists)
    """
    if not mx_hosts:
        return "invalid", "No mail server found", False

    # Standard handshake check
    for host in mx_hosts:
        try:
            # Connect to SMTP server on port 25
            logger.info(f"Connecting to SMTP host {host} for verifying {email}")
            server = smtplib.SMTP(host, port=25, timeout=5)
            
            # EHLO / HELO
            code, message = server.ehlo("verifier.local")
            if not (200 <= code <= 299):
                code, message = server.helo("verifier.local")
            
            # MAIL FROM
            server.mail("verifier@example.com")
            
            # RCPT TO
            code, message = server.rcpt(email)
            server.quit()
            
            logger.info(f"SMTP rcpt code response: {code} - message: {message}")
            
            # 250 means mailbox exists and is deliverable
            if code == 250:
                return "valid", "Email exists", True
            # 550, 551, 552, 553 indicate mailbox doesn't exist
            elif code in (550, 551, 552, 553):
                return "invalid", "Email doesn't exist", False
            else:
                # Other status codes might indicate rate-limits, gray-listing, or blocking
                return "unknown", "Mailbox could not be verified", False
        except Exception as e:
            logger.warning(f"SMTP handshake failed with host {host}: {str(e)}")
            continue
            
    return "unknown", "Mailbox could not be verified", False

def is_major_provider(domain, mx_hosts):
    """Returns True if domain or MX hosts are associated with major providers like Gmail, Yahoo, Outlook."""
    if domain.lower() in MAJOR_PROVIDERS:
        return True
    
    for host in mx_hosts:
        host_lower = host.lower()
        if any(keyword in host_lower for keyword in MAJOR_MX_KEYWORDS):
            return True
            
    return False

def check_major_provider_playwright(email, domain):
    """Uses Playwright headless browser to verify account existence on major sign-in interfaces."""
    try:
        logger.info(f"Attempting Playwright fallback check for {email}")
        with sync_playwright() as p:
            browser = p.webkit.launch(headless=True)
            context = browser.new_context(
                viewport={"width": 1280, "height": 800},
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = context.new_page()

            domain_lower = domain.lower()
            if domain_lower in ("gmail.com", "googlemail.com"):
                username = email.split('@')[0]
                logger.info(f"Attempting Google Signup flow validation for username: {username}")
                page.goto("https://accounts.google.com/signup", timeout=20000)
                page.wait_for_load_state("domcontentloaded")
                
                # Step 1: Name Page
                page.wait_for_selector("input[name='firstName']", timeout=10000)
                page.fill("input[name='firstName']", "Zishan")
                page.fill("input[name='lastName']", "Malek")
                page.locator("button:has-text('Next')").first.click()
                
                # Step 2: Birthday/Gender Page
                page.wait_for_selector("input#day", timeout=15000)
                page.fill("input#day", "15")
                page.fill("input#year", "1995")
                
                # Select Month
                page.locator("div.VfPpkd-TkwUic").first.click()
                page.wait_for_timeout(500)
                page.locator("li[role='option']:has-text('January')").click()
                page.wait_for_timeout(500)
                
                # Select Gender
                page.locator("div.VfPpkd-TkwUic").nth(1).click()
                page.wait_for_timeout(500)
                page.locator("li[role='option']:has-text('Male')").first.click()
                page.wait_for_timeout(500)
                
                # Click Next
                page.locator("button:has-text('Next')").first.click()
                
                # Step 3: Username Page
                page.wait_for_timeout(4000)
                
                # Check if suggestions radio buttons exist, select "custom" if present
                custom_radio = page.locator("input[name='usernameRadio'][value='custom']")
                if custom_radio.count() > 0:
                    custom_radio.click()
                    page.wait_for_timeout(500)
                
                page.wait_for_selector("input[name='Username']", timeout=15000)
                page.fill("input[name='Username']", username)
                
                # Click Next to submit username
                page.locator("button:has-text('Next')").first.click()
                page.wait_for_timeout(4000)
                
                url = page.url
                body_text = page.locator("body").text_content()
                
                if "signup/password" in url:
                    # Proceeded to password step, meaning the username is available (email does not exist)
                    return "invalid", "Email doesn't exist", False
                elif "signup/username" in url:
                    # Remained on username step, check if it's taken
                    if "taken" in body_text.lower() or "choose another" in body_text.lower() or "try another" in body_text.lower():
                        return "valid", "Email exists", True
                    else:
                        return "unknown", "Mailbox could not be verified", False
                else:
                    return "unknown", "Mailbox could not be verified", False


            elif "yahoo" in domain_lower or domain_lower in ("aol.com", "yahoo.com"):
                page.goto("https://login.yahoo.com/", timeout=15000)
                page.wait_for_load_state("domcontentloaded")
                page.wait_for_selector("#login-username", timeout=15000)
                page.fill("#login-username", email)
                page.click("#login-signin")
                page.wait_for_timeout(2500)
                content = page.content()
                
                if "we don't recognize this email" in content or "don't recognize this" in content or "Invalid username" in content:
                    return "invalid", "Email doesn't exist", False
                elif "password" in content or page.locator("input[type='password']").count() > 0 or page.locator("#login-passwd").count() > 0:
                    return "valid", "Email exists", True
                else:
                    return "unknown", "Mailbox could not be verified", False

            elif domain_lower in ("outlook.com", "hotmail.com", "live.com", "msn.com"):
                page.goto("https://login.live.com/", timeout=15000)
                page.wait_for_load_state("domcontentloaded")
                page.wait_for_selector("input[name='loginfmt']", timeout=15000)
                page.fill("input[name='loginfmt']", email)
                page.click("input[type='submit']")
                page.wait_for_timeout(2500)
                content = page.content()
                
                if "Microsoft account doesn't exist" in content or "doesn't exist" in content:
                    return "invalid", "Email doesn't exist", False
                elif "password" in content or page.locator("input[type='password']").count() > 0 or page.locator("input[name='passwd']").count() > 0:
                    return "valid", "Email exists", True
                else:
                    return "unknown", "Mailbox could not be verified", False

            return "unknown", "Mailbox could not be verified", False

    except Exception as e:
        logger.error(f"Playwright validation failed for {email}: {e}")
        return "unknown", "Mailbox could not be verified", False

@app.route('/api/verify', methods=['GET'])
def verify_email():
    email = request.args.get('email', '').strip()
    
    # 1. Check input length to prevent DOS/extreme input sizes
    if not email or len(email) > 254:
        return jsonify({
            "email": email,
            "status": "invalid",
            "reason": "Invalid email format",
            "exists": False,
            "has_mx": False,
            "is_disposable": False,
            "is_catch_all": False
        }), 200

    # 2. Check syntax validation
    if not validate_syntax(email):
        return jsonify({
            "email": email,
            "status": "invalid",
            "reason": "Invalid email format",
            "exists": False,
            "has_mx": False,
            "is_disposable": False,
            "is_catch_all": False
        }), 200

    parts = email.split('@')
    domain = parts[1]

    # 3. Check disposable domain
    if check_disposable(domain):
        return jsonify({
            "email": email,
            "status": "invalid",
            "reason": "Disposable email detected",
            "exists": False,
            "has_mx": False,
            "is_disposable": True,
            "is_catch_all": False
        }), 200

    # 4. Resolve Domain / MX Records
    mx_hosts, has_mx, domain_exists = resolve_mx_records(domain)
    
    if not domain_exists:
        return jsonify({
            "email": email,
            "status": "invalid",
            "reason": "Domain doesn't exist",
            "exists": False,
            "has_mx": False,
            "is_disposable": False,
            "is_catch_all": False
        }), 200

    if not has_mx:
        return jsonify({
            "email": email,
            "status": "invalid",
            "reason": "No mail server found",
            "exists": False,
            "has_mx": False,
            "is_disposable": False,
            "is_catch_all": False
        }), 200



    # 6. Fallback local validation logic
    # Check if domain or MX belongs to a major provider (Gmail, Outlook, Yahoo)
    if is_major_provider(domain, mx_hosts):
        logger.info(f"Email {email} is hosted on a major provider. Attempting Playwright verification.")
        status, reason, exists = check_major_provider_playwright(email, domain)
        
        if status in ("valid", "invalid"):
            return jsonify({
                "email": email,
                "status": status,
                "reason": reason,
                "exists": exists,
                "has_mx": True,
                "is_disposable": False,
                "is_catch_all": False
            }), 200

        return jsonify({
            "email": email,
            "status": "unknown",
            "reason": "Mailbox could not be verified",
            "exists": False,
            "has_mx": True,
            "is_disposable": False,
            "is_catch_all": False
        }), 200

    # For other providers, perform the local SMTP handshake check
    status, reason, exists = check_mailbox_existence_smtp(email, mx_hosts)
    
    return jsonify({
        "email": email,
        "status": status,
        "reason": reason,
        "exists": exists,
        "has_mx": True,
        "is_disposable": False,
        "is_catch_all": False
    }), 200

@app.route('/')
def home():
    return render_template('index.html')

if __name__ == '__main__':
    import os
    # Default to 127.0.0.1 for local dev, but allow overriding (e.g. 0.0.0.0 for Docker/Render)
    host = os.environ.get("FLASK_RUN_HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", 5000))
    debug_mode = os.environ.get("FLASK_DEBUG", "True").lower() in ("true", "1", "yes")
    app.run(host=host, port=port, debug=debug_mode)
