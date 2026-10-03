// GENERATED — do not edit. Run scripts/sync-email-kit.sh after changing src/lib/email-kit.
// Generated from the Medic Connect email kit (components.json). Do not edit by hand.

export const CATALOGUE = {
  "meta": {
    "brand": "Medic Connect",
    "version": "1.0",
    "emailWidth": 600,
    "fontStack": "Figtree, 'Helvetica Neue', Helvetica, Arial, sans-serif",
    "assetBase": "{{ASSET_BASE}}",
    "contact": {
      "whatsapp": "+234 812 698 8237",
      "whatsappUrl": "https://wa.me/2348126988237",
      "email": "hello@medicconnect.co",
      "address": "145 Igbosere Road, Lagos Island"
    },
    "notes": [
      "Blocks are stored as data plus an id. Never store rendered HTML as the source of truth.",
      "Service prices read 'from ₦X' until a real figure is supplied by the price list.",
      "The home care needs assessment is a fixed ₦35,000 and every care plan starts with it."
    ]
  },
  "tokens": {
    "color": {
      "deepBlue": "#26306B",
      "brandBlue": "#3B4DC4",
      "softBlue": "#5B6BE5",
      "tint": "#EEF1FF",
      "warmWhite": "#FAF8F4",
      "white": "#FFFFFF",
      "ink": "#1A1F2E",
      "bodyGrey": "#3A4152",
      "muted": "#6B7285",
      "labelGrey": "#8A90A2",
      "hairline": "#E4E1DA",
      "hairlineOnTint": "#D5DAF5",
      "hairlineOnNavy": "#454FA8",
      "navyBody": "#C6CBF0",
      "navyMuted": "#A8B0E8",
      "hotRed": "#FF2E2E"
    },
    "colorRules": {
      "hotRed": "Prices only, and the cross in the logo. Never a button, alert, or border.",
      "softBlue": "Rare. Secondary accents only."
    },
    "type": {
      "mastheadHeadline": {
        "size": "25-29px",
        "lineHeight": 1.25,
        "weight": 500
      },
      "blockHeading": {
        "size": "19-21px",
        "lineHeight": 1.35,
        "weight": 600
      },
      "body": {
        "size": "15px",
        "lineHeight": 1.7,
        "weight": 400
      },
      "smallBody": {
        "size": "14px",
        "lineHeight": 1.65,
        "weight": 400
      },
      "eyebrow": {
        "size": "10px",
        "tracking": "0.2em",
        "transform": "uppercase",
        "weight": 700
      },
      "label": {
        "size": "11px",
        "tracking": "0.14em",
        "transform": "uppercase",
        "weight": 700
      },
      "price": {
        "size": "18-20px",
        "weight": 700,
        "color": "#FF2E2E",
        "prefix": "from"
      },
      "legal": {
        "size": "11.5px",
        "lineHeight": 1.6,
        "weight": 400
      },
      "minimumSize": "11.5px"
    },
    "spacing": {
      "blockPaddingX": 44,
      "blockPaddingY": 32,
      "panelPadding": 28,
      "gap": 16
    }
  },
  "assemblyRules": [
    {
      "id": "one-masthead",
      "rule": "Exactly one masthead block, first in the list."
    },
    {
      "id": "one-footer",
      "rule": "Exactly one footer block, last in the list."
    },
    {
      "id": "footer-kind",
      "rule": "kind=marketing requires ft-marketing with an unsubscribe link. kind=transactional requires ft-transactional and must not carry one."
    },
    {
      "id": "one-primary",
      "rule": "At most one btn-primary per email. Further actions use btn-secondary or btn-link."
    },
    {
      "id": "red-price-only",
      "rule": "#FF2E2E may only appear on a price value."
    },
    {
      "id": "no-mixing",
      "rule": "Campaign blocks (cmp-*) and utility blocks (utl-*) must not appear in the same email."
    },
    {
      "id": "price-prefix",
      "rule": "Service prices are prefixed 'from'. The assessment fee is fixed at ₦35,000."
    },
    {
      "id": "max-photos",
      "rule": "At most two body photographs per email."
    },
    {
      "id": "alt-required",
      "rule": "Every image slot requires non empty alt text and the email must read with images off."
    },
    {
      "id": "subject-length",
      "rule": "Subject up to 55 characters. Preheader 40 to 90 characters and not a repeat of the subject."
    },
    {
      "id": "size-budget",
      "rule": "Keep rendered HTML under roughly 100KB to avoid Gmail clipping."
    }
  ],
  "groups": [
    {
      "id": "masthead",
      "name": "Mastheads",
      "position": "first",
      "max": 1
    },
    {
      "id": "button",
      "name": "Buttons and links",
      "position": "inline"
    },
    {
      "id": "campaign",
      "name": "Campaign blocks",
      "position": "body"
    },
    {
      "id": "utility",
      "name": "Utility blocks",
      "position": "body"
    },
    {
      "id": "small",
      "name": "Small parts",
      "position": "body"
    },
    {
      "id": "footer",
      "name": "Footers",
      "position": "last",
      "max": 1
    }
  ],
  "blocks": [
    {
      "id": "mh-newsletter",
      "group": "masthead",
      "name": "Newsletter masthead, dated",
      "surface": "#FAF8F4",
      "slots": {
        "title": {
          "type": "text",
          "maxChars": 24,
          "default": "The care letter",
          "required": true
        },
        "date": {
          "type": "text",
          "maxChars": 18,
          "default": "August 2026",
          "required": true
        }
      },
      "images": {
        "logo": {
          "fixed": "medicconnect-logo.svg",
          "width": 142,
          "alt": "Medic Connect"
        }
      }
    },
    {
      "id": "mh-campaign",
      "group": "masthead",
      "name": "Campaign masthead, watermarked",
      "surface": "#26306B",
      "slots": {
        "strapline": {
          "type": "text",
          "maxChars": 44,
          "default": "Home nursing and caregiving, Lagos",
          "required": true
        }
      },
      "images": {
        "logo": {
          "fixed": "medicconnect-logo-white.svg",
          "width": 142,
          "alt": "Medic Connect"
        },
        "watermark": {
          "fixed": "m-full-soft.svg",
          "decorative": true
        }
      },
      "notes": "Watermark is a background image with a VML fallback. Degrades to flat navy."
    },
    {
      "id": "mh-transactional",
      "group": "masthead",
      "name": "Transactional masthead",
      "surface": "#FFFFFF",
      "slots": {},
      "images": {
        "logo": {
          "fixed": "medicconnect-logo.svg",
          "width": 126,
          "alt": "Medic Connect"
        }
      }
    },
    {
      "id": "mh-eyebrow",
      "group": "masthead",
      "name": "Eyebrow only, personal sends",
      "surface": "#FAF8F4",
      "slots": {
        "eyebrow": {
          "type": "text",
          "maxChars": 32,
          "default": "A note from the care team",
          "required": true
        }
      },
      "images": {}
    },
    {
      "id": "btn-primary",
      "group": "button",
      "name": "Primary button",
      "limitPerEmail": 1,
      "slots": {
        "label": {
          "type": "text",
          "maxChars": 26,
          "default": "Book the assessment",
          "required": true
        }
      },
      "links": {
        "href": {
          "required": true
        }
      }
    },
    {
      "id": "btn-secondary",
      "group": "button",
      "name": "Secondary button, outline",
      "slots": {
        "label": {
          "type": "text",
          "maxChars": 26,
          "default": "See our services",
          "required": true
        }
      },
      "links": {
        "href": {
          "required": true
        }
      }
    },
    {
      "id": "btn-on-navy",
      "group": "button",
      "name": "White button on navy",
      "requiresSurface": "#26306B",
      "slots": {
        "label": {
          "type": "text",
          "maxChars": 22,
          "default": "Talk to us",
          "required": true
        }
      },
      "links": {
        "href": {
          "required": true
        }
      }
    },
    {
      "id": "btn-whatsapp",
      "group": "button",
      "name": "WhatsApp row",
      "slots": {
        "label": {
          "type": "text",
          "maxChars": 34,
          "default": "WhatsApp +234 812 698 8237",
          "required": true
        }
      },
      "links": {
        "href": {
          "default": "https://wa.me/2348126988237"
        }
      }
    },
    {
      "id": "btn-link",
      "group": "button",
      "name": "Arrow text link",
      "slots": {
        "label": {
          "type": "text",
          "maxChars": 34,
          "default": "Read the care guide",
          "required": true
        }
      },
      "links": {
        "href": {
          "required": true
        }
      }
    },
    {
      "id": "btn-full",
      "group": "button",
      "name": "Full width button, mobile heavy sends",
      "slots": {
        "label": {
          "type": "text",
          "maxChars": 26,
          "default": "Start your enquiry",
          "required": true
        }
      },
      "links": {
        "href": {
          "required": true
        }
      }
    },
    {
      "id": "cmp-hero",
      "group": "campaign",
      "name": "Hero campaign block",
      "slots": {
        "eyebrow": {
          "type": "text",
          "maxChars": 20,
          "required": true
        },
        "heading": {
          "type": "text",
          "maxChars": 60,
          "required": true
        },
        "body": {
          "type": "richtext",
          "maxChars": 260,
          "required": true
        },
        "priceLabel": {
          "type": "text",
          "maxChars": 22
        },
        "price": {
          "type": "price",
          "default": "from ₦X"
        },
        "cta": {
          "type": "text",
          "maxChars": 26,
          "required": true
        }
      },
      "images": {
        "photo": {
          "width": 600,
          "height": 260,
          "altRequired": true,
          "brief": "Subject at home in daylight, warm, uncluttered"
        }
      },
      "links": {
        "cta": {
          "required": true
        }
      }
    },
    {
      "id": "cmp-split",
      "group": "campaign",
      "name": "Side by side service block",
      "mobile": "stacks",
      "slots": {
        "eyebrow": {
          "type": "text",
          "maxChars": 20,
          "required": true
        },
        "heading": {
          "type": "text",
          "maxChars": 44,
          "required": true
        },
        "body": {
          "type": "text",
          "maxChars": 150,
          "required": true
        },
        "price": {
          "type": "price",
          "default": "from ₦X"
        },
        "linkLabel": {
          "type": "text",
          "maxChars": 30
        }
      },
      "images": {
        "photo": {
          "width": 440,
          "height": 440,
          "altRequired": true,
          "brief": "Caregiver and client, hands or a shared task"
        }
      },
      "links": {
        "href": {}
      }
    },
    {
      "id": "cmp-threeup",
      "group": "campaign",
      "name": "Three up service grid",
      "mobile": "one column",
      "repeat": {
        "key": "items",
        "count": 3
      },
      "slots": {
        "eyebrow": {
          "type": "text",
          "maxChars": 20,
          "default": "Three services"
        },
        "items[].title": {
          "type": "text",
          "maxChars": 24,
          "required": true
        },
        "items[].body": {
          "type": "text",
          "maxChars": 90,
          "required": true
        },
        "items[].price": {
          "type": "price",
          "default": "from ₦X"
        }
      },
      "images": {
        "items[].photo": {
          "width": 160,
          "height": 110,
          "altRequired": true
        }
      }
    },
    {
      "id": "cmp-recruit",
      "group": "campaign",
      "name": "Recruitment band, navy",
      "surface": "#26306B",
      "slots": {
        "eyebrow": {
          "type": "text",
          "maxChars": 18,
          "default": "We are hiring"
        },
        "heading": {
          "type": "text",
          "maxChars": 60,
          "required": true
        },
        "body": {
          "type": "text",
          "maxChars": 160,
          "required": true
        },
        "cta": {
          "type": "text",
          "maxChars": 22,
          "default": "Apply to join"
        }
      },
      "images": {
        "watermark": {
          "fixed": "m-inf-soft.svg",
          "decorative": true
        }
      },
      "links": {
        "cta": {
          "required": true
        }
      }
    },
    {
      "id": "cmp-quote",
      "group": "campaign",
      "name": "Family testimonial pull quote",
      "surface": "#EEF1FF",
      "slots": {
        "quote": {
          "type": "text",
          "maxChars": 200,
          "required": true
        },
        "attribution": {
          "type": "text",
          "maxChars": 26,
          "required": true
        },
        "context": {
          "type": "text",
          "maxChars": 34
        }
      },
      "images": {
        "photo": {
          "width": 176,
          "height": 176,
          "altRequired": true,
          "brief": "Portrait or hands, permission on file"
        }
      },
      "notes": "Only real quotes with written permission. Attribution as initial and area."
    },
    {
      "id": "utl-table",
      "group": "utility",
      "name": "Detail table",
      "repeat": {
        "key": "rows",
        "min": 2,
        "max": 8
      },
      "slots": {
        "eyebrow": {
          "type": "text",
          "maxChars": 22,
          "default": "Your appointment"
        },
        "rows[].label": {
          "type": "text",
          "maxChars": 20,
          "required": true
        },
        "rows[].value": {
          "type": "text",
          "maxChars": 60,
          "required": true
        },
        "rows[].isPrice": {
          "type": "boolean",
          "default": false
        }
      },
      "notes": "isPrice renders the value in hot red. The only place red is allowed here."
    },
    {
      "id": "utl-steps",
      "group": "utility",
      "name": "Numbered steps",
      "repeat": {
        "key": "steps",
        "count": 3
      },
      "slots": {
        "eyebrow": {
          "type": "text",
          "maxChars": 24,
          "default": "What happens next"
        },
        "steps[].title": {
          "type": "text",
          "maxChars": 26,
          "required": true
        },
        "steps[].body": {
          "type": "text",
          "maxChars": 110,
          "required": true
        }
      }
    },
    {
      "id": "utl-cta",
      "group": "utility",
      "name": "Closing call to action band",
      "slots": {
        "heading": {
          "type": "text",
          "maxChars": 46,
          "required": true
        },
        "body": {
          "type": "text",
          "maxChars": 110
        },
        "cta": {
          "type": "text",
          "maxChars": 24,
          "required": true
        }
      },
      "links": {
        "cta": {
          "required": true
        }
      }
    },
    {
      "id": "utl-stats",
      "group": "utility",
      "name": "Reassurance row",
      "repeat": {
        "key": "items",
        "count": 3
      },
      "slots": {
        "items[].figure": {
          "type": "text",
          "maxChars": 12,
          "required": true
        },
        "items[].body": {
          "type": "text",
          "maxChars": 44,
          "required": true
        }
      },
      "notes": "Facts only. No invented totals or service counts."
    },
    {
      "id": "sm-rule-full",
      "group": "small",
      "name": "Full hairline rule",
      "slots": {}
    },
    {
      "id": "sm-rule-short",
      "group": "small",
      "name": "Short blue rule",
      "slots": {}
    },
    {
      "id": "sm-rule-mark",
      "group": "small",
      "name": "Mark rule, end of letter",
      "slots": {},
      "images": {
        "mark": {
          "fixed": "m-cross-blue.svg",
          "width": 16,
          "decorative": true
        }
      }
    },
    {
      "id": "sm-notice-info",
      "group": "small",
      "name": "Notice, information",
      "surface": "#EEF1FF",
      "slots": {
        "body": {
          "type": "text",
          "maxChars": 150,
          "required": true
        }
      }
    },
    {
      "id": "sm-notice-chase",
      "group": "small",
      "name": "Notice, follow up",
      "surface": "#FAF8F4",
      "slots": {
        "body": {
          "type": "text",
          "maxChars": 150,
          "required": true
        }
      }
    },
    {
      "id": "sm-notice-urgent",
      "group": "small",
      "name": "Notice, blocking issue",
      "surface": "#26306B",
      "slots": {
        "body": {
          "type": "text",
          "maxChars": 150,
          "required": true
        }
      },
      "notes": "Navy, not red. Wording carries the urgency."
    },
    {
      "id": "sm-checklist",
      "group": "small",
      "name": "Checklist",
      "repeat": {
        "key": "items",
        "min": 2,
        "max": 6
      },
      "slots": {
        "eyebrow": {
          "type": "text",
          "maxChars": 26,
          "default": "Before the nurse arrives"
        },
        "items[].body": {
          "type": "text",
          "maxChars": 90,
          "required": true
        }
      }
    },
    {
      "id": "sm-qa",
      "group": "small",
      "name": "Question and answer list",
      "repeat": {
        "key": "items",
        "min": 2,
        "max": 5
      },
      "slots": {
        "eyebrow": {
          "type": "text",
          "maxChars": 26,
          "default": "Questions families ask"
        },
        "items[].question": {
          "type": "text",
          "maxChars": 60,
          "required": true
        },
        "items[].answer": {
          "type": "text",
          "maxChars": 140,
          "required": true
        }
      }
    },
    {
      "id": "sm-referral",
      "group": "small",
      "name": "Referral block",
      "surface": "#EEF1FF",
      "slots": {
        "eyebrow": {
          "type": "text",
          "maxChars": 20,
          "default": "Refer a family"
        },
        "heading": {
          "type": "text",
          "maxChars": 60,
          "required": true
        },
        "body": {
          "type": "text",
          "maxChars": 160,
          "required": true
        },
        "cta": {
          "type": "text",
          "maxChars": 22,
          "default": "Send a referral"
        }
      },
      "links": {
        "cta": {
          "default": "https://wa.me/2348126988237"
        }
      }
    },
    {
      "id": "sm-caregiver",
      "group": "small",
      "name": "Caregiver introduction card",
      "slots": {
        "eyebrow": {
          "type": "text",
          "maxChars": 18,
          "default": "Your caregiver"
        },
        "name": {
          "type": "text",
          "maxChars": 28,
          "required": true
        },
        "credentials": {
          "type": "text",
          "maxChars": 70,
          "required": true
        },
        "body": {
          "type": "text",
          "maxChars": 110
        }
      },
      "images": {
        "photo": {
          "width": 148,
          "height": 148,
          "altRequired": true,
          "brief": "Plain background staff portrait, consent on file"
        }
      },
      "notes": "Credential segments separated by a thin rule, never a middot."
    },
    {
      "id": "ft-marketing",
      "group": "footer",
      "name": "Marketing footer",
      "surface": "#26306B",
      "requiredFor": "marketing",
      "slots": {
        "blurb": {
          "type": "text",
          "maxChars": 130,
          "default": "Home nursing and caregiving in Lagos, matched to a plan built from a nurse led assessment."
        }
      },
      "images": {
        "logo": {
          "fixed": "medicconnect-logo-white.svg",
          "width": 130,
          "alt": "Medic Connect"
        }
      },
      "links": {
        "website": {},
        "instagram": {},
        "linkedin": {},
        "unsubscribe": {
          "required": true
        },
        "preferences": {
          "required": true
        }
      }
    },
    {
      "id": "ft-transactional",
      "group": "footer",
      "name": "Transactional footer",
      "surface": "#FAF8F4",
      "requiredFor": "transactional",
      "slots": {},
      "images": {
        "logo": {
          "fixed": "medicconnect-logo.svg",
          "width": 112,
          "alt": "Medic Connect"
        }
      },
      "links": {
        "website": {},
        "instagram": {},
        "linkedin": {}
      },
      "notes": "No unsubscribe link."
    },
    {
      "id": "ft-signature",
      "group": "footer",
      "name": "Personal signature block",
      "surface": "#FFFFFF",
      "slots": {
        "senderName": {
          "type": "text",
          "maxChars": 30,
          "required": true
        },
        "senderRole": {
          "type": "text",
          "maxChars": 30,
          "required": true
        }
      },
      "images": {
        "logo": {
          "fixed": "medicconnect-logo.svg",
          "width": 116,
          "alt": "Medic Connect"
        }
      }
    },
    {
      "id": "utl-tiers",
      "group": "utility",
      "name": "Tiered pricing block",
      "repeat": {
        "key": "tiers",
        "min": 2,
        "max": 4
      },
      "slots": {
        "eyebrow": {
          "type": "text",
          "maxChars": 22,
          "default": "Your care plan"
        },
        "heading": {
          "type": "text",
          "maxChars": 52,
          "required": true
        },
        "tiers[].name": {
          "type": "text",
          "maxChars": 24,
          "required": true
        },
        "tiers[].body": {
          "type": "text",
          "maxChars": 90,
          "required": true
        },
        "tiers[].price": {
          "type": "price",
          "default": "from ₦X"
        },
        "tiers[].recommended": {
          "type": "boolean",
          "default": false
        },
        "note": {
          "type": "text",
          "maxChars": 120,
          "default": "Prices exclude the ₦35,000 home care needs assessment, which has already been carried out."
        },
        "cta": {
          "type": "text",
          "maxChars": 24,
          "default": "Confirm your plan"
        }
      },
      "links": {
        "cta": {
          "default": "https://wa.me/2348126988237"
        }
      },
      "notes": "At most one tier may be recommended. The recommended tier is the only filled row, tint background with a brand blue border."
    },
    {
      "id": "social-row",
      "group": "small",
      "name": "Social row",
      "variants": [
        "text",
        "marks-light",
        "marks-navy"
      ],
      "slots": {
        "variant": {
          "type": "enum",
          "options": [
            "text",
            "marks-light",
            "marks-navy"
          ],
          "default": "text"
        }
      },
      "links": {
        "website": {},
        "instagram": {},
        "linkedin": {},
        "facebook": {}
      },
      "images": {
        "marks": {
          "width": 32,
          "height": 32,
          "note": "Official platform marks, flat colour, 64px PNG for 32px display"
        }
      },
      "notes": "Used inside footers. Text variant is the default because it needs no images."
    }
  ],
  "recipes": [
    {
      "id": "enquiry-ack",
      "name": "Enquiry acknowledgement",
      "kind": "transactional",
      "blocks": [
        "mh-transactional",
        "text-greeting",
        "utl-steps",
        "btn-whatsapp",
        "ft-transactional"
      ]
    },
    {
      "id": "assessment-booked",
      "name": "Assessment booked",
      "kind": "transactional",
      "blocks": [
        "mh-transactional",
        "utl-table",
        "sm-checklist",
        "ft-transactional"
      ]
    },
    {
      "id": "assessment-reminder",
      "name": "Assessment reminder",
      "kind": "transactional",
      "blocks": [
        "mh-transactional",
        "sm-notice-info",
        "sm-checklist",
        "ft-transactional"
      ]
    },
    {
      "id": "care-plan-sent",
      "name": "Care plan sent",
      "kind": "transactional",
      "blocks": [
        "mh-transactional",
        "text-body",
        "utl-tiers",
        "ft-transactional"
      ]
    },
    {
      "id": "invoice",
      "name": "Invoice or receipt",
      "kind": "transactional",
      "blocks": [
        "mh-transactional",
        "utl-table",
        "sm-notice-info",
        "ft-transactional"
      ]
    },
    {
      "id": "payment-overdue",
      "name": "Payment overdue",
      "kind": "transactional",
      "blocks": [
        "mh-transactional",
        "sm-notice-urgent",
        "utl-table",
        "btn-whatsapp",
        "ft-transactional"
      ]
    },
    {
      "id": "caregiver-assigned",
      "name": "Caregiver assigned",
      "kind": "transactional",
      "blocks": [
        "mh-transactional",
        "sm-caregiver",
        "utl-table",
        "ft-transactional"
      ]
    },
    {
      "id": "newsletter",
      "name": "Monthly newsletter",
      "kind": "marketing",
      "blocks": [
        "mh-newsletter",
        "cmp-hero",
        "sm-rule-full",
        "cmp-threeup",
        "cmp-quote",
        "utl-cta",
        "ft-marketing"
      ]
    },
    {
      "id": "seasonal",
      "name": "Seasonal campaign",
      "kind": "marketing",
      "blocks": [
        "mh-campaign",
        "cmp-hero",
        "utl-stats",
        "utl-cta",
        "ft-marketing"
      ]
    },
    {
      "id": "service-launch",
      "name": "Service launch",
      "kind": "marketing",
      "blocks": [
        "mh-campaign",
        "cmp-split",
        "sm-qa",
        "utl-cta",
        "ft-marketing"
      ]
    },
    {
      "id": "referral",
      "name": "Referral invitation",
      "kind": "marketing",
      "blocks": [
        "mh-newsletter",
        "text-body",
        "sm-referral",
        "ft-marketing"
      ]
    },
    {
      "id": "recruitment",
      "name": "Recruitment drive",
      "kind": "marketing",
      "blocks": [
        "mh-campaign",
        "cmp-recruit",
        "utl-stats",
        "btn-primary",
        "ft-marketing"
      ]
    },
    {
      "id": "application-received",
      "name": "Application received",
      "kind": "transactional",
      "blocks": [
        "mh-transactional",
        "text-body",
        "utl-steps",
        "ft-transactional"
      ]
    },
    {
      "id": "partner-outreach",
      "name": "Partner outreach",
      "kind": "transactional",
      "blocks": [
        "mh-eyebrow",
        "text-body",
        "utl-stats",
        "btn-link",
        "ft-signature"
      ]
    },
    {
      "id": "partner-update",
      "name": "Quarterly partner update",
      "kind": "marketing",
      "blocks": [
        "mh-newsletter",
        "text-body",
        "utl-stats",
        "cmp-quote",
        "ft-signature"
      ]
    }
  ],
  "textBlocks": [
    {
      "id": "text-greeting",
      "name": "Greeting and opening",
      "slots": {
        "greeting": {
          "type": "text",
          "maxChars": 30,
          "default": "Hello,"
        },
        "body": {
          "type": "richtext",
          "maxChars": 400,
          "required": true
        }
      }
    },
    {
      "id": "text-body",
      "name": "Body copy",
      "slots": {
        "heading": {
          "type": "text",
          "maxChars": 60
        },
        "body": {
          "type": "richtext",
          "maxChars": 700,
          "required": true
        }
      },
      "notes": "Bold, italic and links only. No inline colour or size."
    }
  ],
  "inbox": {
    "senderName": "Medic Connect",
    "rules": [
      "Sender name is always Medic Connect. Never a person's name, never a no reply address.",
      "Subject up to 55 characters, sentence case, no exclamation marks.",
      "Preheader 40 to 90 characters and never a repeat of the subject.",
      "Transactional subjects state the fact. Marketing subjects state the offer."
    ]
  },
  "mobile": {
    "breakpoint": 600,
    "designWidth": 375,
    "rules": [
      "cmp-split stacks with the photo above the text, photo full width and cropped.",
      "cmp-threeup becomes one column, each item a 96 by 70 photo beside its text.",
      "utl-cta stacks with the button full width under the copy.",
      "Any btn-primary in a mobile heavy send renders as btn-full."
    ]
  },
  "imagesOff": {
    "rules": [
      "Alt text reads as a sentence, never a file name.",
      "Navy surfaces use bgcolor so the colour survives blocked images.",
      "Every send goes out with a plain text alternative, naira written as '35,000 naira' in plain text.",
      "No text that the reader needs may live inside an image."
    ]
  },
  "darkMode": {
    "strategy": "Designed, not inherited. Force these surfaces rather than letting clients invert them.",
    "swaps": {
      "#FAF8F4": "#14161F",
      "#EEF1FF": "#1E2340",
      "#E4E1DA": "#2C3040",
      "#3A4152": "#B9BCC8",
      "#1A1F2E": "#F2F0EA",
      "#3B4DC4": "#8E9BFF",
      "#FF2E2E": "#FF6B6B",
      "#26306B": "#26306B"
    },
    "notes": "Lightened red is still prices only. Buttons on dark use #8E9BFF with #14161F label text."
  },
  "iconography": {
    "grid": 24,
    "strokeWidth": 1.75,
    "caps": "round",
    "joins": "round",
    "sizeBesideText": 20,
    "sizeStandalone": 24,
    "strokeColor": {
      "onLight": "#3B4DC4",
      "onNavy": "#FFFFFF"
    },
    "gaps": {
      "iconToText": 12,
      "iconToIcon": 14
    },
    "functionalSet": [
      "phone",
      "email",
      "address",
      "appointment",
      "hours",
      "included",
      "next",
      "supervised"
    ],
    "emailRules": [
      "Ship every icon as a PNG at twice its display size. Several clients will not render an SVG.",
      "One flat stroke colour per icon. Never two colours in one glyph.",
      "Alt text on any icon that carries meaning, empty alt where the text beside it says the same thing.",
      "No meaning may rest on a glyph alone."
    ],
    "socialTreatments": [
      {
        "id": "social-text",
        "name": "Text links",
        "default": true,
        "notes": "No images, survives blocking. The default."
      },
      {
        "id": "social-marks-light",
        "name": "Monochrome marks on light",
        "notes": "Official platform marks recoloured flat to #3B4DC4, 32px box."
      },
      {
        "id": "social-marks-navy",
        "name": "Monochrome marks on navy",
        "notes": "Official platform marks recoloured flat to #FFFFFF, 32px box, on #26306B."
      }
    ],
    "platformMarks": "Use the official mark from each platform's brand page, recoloured to a single flat colour. Never the multicolour version, never a coloured circle behind it, never a redrawn approximation."
  }
} as const;
