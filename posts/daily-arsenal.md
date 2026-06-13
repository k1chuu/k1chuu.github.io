On a daily basis, We'll need a arsenal of tools to help the investigations.

## Threat Intelligence 
The Threat Intelligence is the analysis of data and information using tools and techniques to generate meaningful patterns on how to mitigate against risks

## Tools

- [VirusTotal](https://www.virustotal.com/) — Aggregates results from many security vendors to check files, URLs, domains, and IP addresses for malicious activity. It can also calculate and compare file hashes.

- [urlscan.io](https://urlscan.io/) — Analyzes websites by loading them in a controlled environment and recording network activity, domains contacted, screenshots, and other indicators.

- [PhishTank](https://phishtank.org/) Community-driven phishing intelligence platform used to identify, verify, and track phishing
websites and URLs.

- [AbuseIPDB](https://www.abuseipdb.com/) — Community-driven database for checking whether an IP address has been reported for malicious activity.

- [Cisco Talos Intelligence](https://talosintelligence.com/) — Offers reputation and threat intelligence data for IPs, domains, URLs, and email-related indicators.

- [Abuse.ch](https://abuse.ch/) — Provides threat intelligence feeds and trackers for malware, botnets, malicious domains, and indicators of compromise (IOCs).

- [CyberChef](https://gchq.github.io/CyberChef/) — Browser-based toolkit for encoding, decoding, hashing, parsing, and transforming data. Popular for forensic and incident-response work.

- [ANY.RUN](https://any.run/) — Interactive malware sandbox that allows analysts to observe malware behavior in a controlled environment.

- [Shodan](https://www.shodan.io/) — Search engine for internet-connected devices and services. Often used for asset discovery, exposure assessment, and security research.


## Typical investigation workflow

**Suspicious URL** : VirusTotal → urlscan.io → PhishTank
**Suspicious IP** : AbuseIPDB → Talos → Abuse.ch → Shodan
**Suspicious File** : VirusTotal → ANY.RUN
**Encoded/Obfuscated Data** : CyberChef