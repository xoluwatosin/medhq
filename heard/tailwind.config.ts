import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		fontFamily: {
  			sans: [
  				'Figtree',
  				'ui-sans-serif',
  				'system-ui',
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'Segoe UI',
  				'Roboto',
  				'Helvetica Neue',
  				'Arial',
  				'Noto Sans',
  				'sans-serif'
  			],
  			serif: [
  				'Figtree',
  				'ui-serif',
  				'Georgia',
  				'Cambria',
  				'Times New Roman',
  				'Times',
  				'serif'
  			],
  		mono: [
  				'SF Mono',
  				'ui-monospace',
  				'SFMono-Regular',
  				'Menlo',
  				'Monaco',
  				'Consolas',
  				'Liberation Mono',
  				'Courier New',
  				'monospace'
  			],
  			handwritten: [
  				'Caveat',
  				'cursive'
  			]
  		},
  		colors: {
  			navy: 'hsl(var(--navy))',
  			brand: {
  				DEFAULT: 'hsl(var(--brand))',
  				soft: 'hsl(var(--brand-soft))'
  			},
  			tint: 'hsl(var(--tint))',
  			ink: 'hsl(var(--ink))',
  			body: 'hsl(var(--body))',
  			label: 'hsl(var(--label))',
  			hairline: {
  				DEFAULT: 'hsl(var(--hairline))',
  				warm: 'hsl(var(--hairline-warm))',
  				tint: 'hsl(var(--hairline-tint))',
  				navy: 'hsl(var(--hairline-navy))'
  			},
  			'outline-navy': 'hsl(var(--outline-navy))',
  			'body-navy': 'hsl(var(--body-navy))',
  			'muted-navy': 'hsl(var(--muted-navy))',
  			price: 'hsl(var(--price))',
  			desk: 'hsl(var(--desk))',
  			ink2: 'hsl(var(--ink-2))',
  			faint: 'hsl(var(--faint))',
  			line: {
  				DEFAULT: 'hsl(var(--line))',
  				soft: 'hsl(var(--line-soft))',
  				tint: 'hsl(var(--tint-border))'
  			},
  			warn: {
  				bg: 'hsl(var(--warn-bg))',
  				ink: 'hsl(var(--warn-ink))',
  				line: 'hsl(var(--warn-line))',
  				wash: 'hsl(var(--warn-wash))'
  			},
  			'grey-pill': 'hsl(var(--grey-pill))',
  			'not-answered': 'hsl(var(--not-answered))',
			status: {
				blue: 'hsl(var(--status-blue))',
				'blue-soft': 'hsl(var(--status-blue-soft))',
				green: 'hsl(var(--status-green))',
				'green-soft': 'hsl(var(--status-green-soft))',
				amber: 'hsl(var(--status-amber))',
				'amber-soft': 'hsl(var(--status-amber-soft))',
				alert: 'hsl(var(--status-alert))',
				'alert-soft': 'hsl(var(--status-alert-soft))'
			},

  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',

  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		},
  		boxShadow: {
  			'2xs': 'var(--shadow-2xs)',
  			xs: 'var(--shadow-xs)',
  			sm: 'var(--shadow-sm)',
  			md: 'var(--shadow-md)',
  			lg: 'var(--shadow-lg)',
  			xl: 'var(--shadow-xl)',
  			'2xl': 'var(--shadow-2xl)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
