/**
 * General Utility & UI Helper Functions
 */

console.log("[Utils] Loading appUtils...");

/**
 * Global Date Display Format: DDMMYY
 */
export function formatDate(dateInput) {
  if (!dateInput) return "-";
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "-";
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}${month}${year}`;
  } catch (e) {
    return "-";
  }
}

/**
 * Formats date to DD-MM-YYYY
 */
export function formatDateDDMMYYYY(dateInput) {
  if (!dateInput) return "-";
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "-";
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (e) {
    return "-";
  }
}

/**
 * Formats date to Month Year (e.g., "April 2026")
 */
export function formatMonthYear(dateInput) {
  if (!dateInput) return "-";
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString("default", { month: "long", year: "numeric" });
  } catch (e) {
    return "-";
  }
}

/**
 * Formats date to "23rd of March 2026"
 */
export function formatFullDateWithSuffix(dateInput) {
  if (!dateInput) return "";
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "";
    const day = date.getDate();
    const month = date.toLocaleString("default", { month: "long" });
    const year = date.getFullYear();

    const getSuffix = (d) => {
      if (d > 3 && d < 21) return "th";
      switch (d % 10) {
        case 1: return "st";
        case 2: return "nd";
        case 3: return "rd";
        default: return "th";
      }
    };
    return `${day}${getSuffix(day)} of ${month} ${year}`;
  } catch (e) {
    return "";
  }
}

/**
 * Calculates days between two dates (inclusive)
 */
export function calculateCycleDays(start, end) {
  if (!start || !end) return 0;
  try {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = endDate - startDate;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  } catch (e) {
    return 0;
  }
}

/**
 * Gets initials from a name
 */
export function getInitials(name) {
  if (!name) return "?";
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

/**
 * Escapes HTML characters to prevent XSS.
 */
export function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Alias for escapeHtml to resolve missing exports.
 */
export function safeText(str) {
  return escapeHtml(str);
}

/**
 * Renders the current date in the header.
 */
export function renderHeaderDate() {
  const el = document.getElementById("headerDate");
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

/**
 * Helper to get first name from a full name.
 */
export function getFirstName(fullName) {
  if (!fullName) return "Unknown";
  return fullName.split(' ')[0];
}

/**
 * Formats user role with an optional tag.
 */
export function formatUserRole(role, tag) {
  let roleDisplay = (role || 'associate').toLowerCase();
  if (roleDisplay === 'employee') roleDisplay = 'associate';
  roleDisplay = roleDisplay.toUpperCase().replace('_', ' ');
  
  if (!tag || tag.trim() === "") return roleDisplay;
  return `${roleDisplay} (${tag})`;
}

/**
 * Formats budget strings by repairing encoding issues and applying standard currency formats.
 */
export function formatBudget(budgetStr) {
  if (!budgetStr) return "-";
  
  // Clean up UTF-8 encoding corruption of Rupee symbol: "â‚¹" -> "₹"
  let cleaned = budgetStr.replace(/â\x80\x9a|â\x80\x99|â‚¹/g, "₹");
  
  // Clean any multiple/adjacent Rupee symbol glitches
  cleaned = cleaned.replace(/₹+/g, "₹").trim();
  
  const numericOnly = cleaned.replace(/[^\d]/g, "");
  const hasNumbers = numericOnly.length > 0;
  
  // If it's a completely raw number string (e.g. "100000")
  if (/^\d+$/.test(cleaned)) {
    const val = parseInt(cleaned, 10);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  }
  
  // If it starts with ₹ and has numbers, re-format the number cleanly
  if (cleaned.startsWith("₹") && hasNumbers) {
    const val = parseInt(numericOnly, 10);
    const suffix = cleaned.includes("/mo") ? "/mo" : (cleaned.includes("total") ? " total" : "");
    if (!isNaN(val)) {
      const formattedNum = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
      }).format(val);
      return `${formattedNum}${suffix}`;
    }
  }

  // If it has numbers but no ₹ prefix, format and add ₹
  if (!cleaned.includes("₹") && hasNumbers) {
    const match = cleaned.match(/([\d,]+)(.*)/);
    if (match) {
      const numStr = match[1].replace(/,/g, "");
      const suffix = match[2];
      const val = parseInt(numStr, 10);
      if (!isNaN(val)) {
        const formattedNum = new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0
        }).format(val);
        return `${formattedNum}${suffix}`;
      }
    }
  }
  
  // Fallback to cleaned string
  return cleaned;
}

/**
 * Renders one or more highly premium styled badges for service interests.
 */
export function formatServiceTag(service) {
  if (!service) return `<span class="service-tag" style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;">-</span>`;
  
  // Split by comma in case of multiple services
  return service.split(',').map(s => {
    const name = s.trim();
    if (!name) return '';
    let bg = "#f1f5f9";
    let fg = "#475569";
    let border = "#e2e8f0";

    switch (name.toLowerCase()) {
      case 'google ads':
        bg = "#eff6ff";
        fg = "#1e40af";
        border = "#bfdbfe";
        break;
      case 'seo':
        bg = "#f0fdf4";
        fg = "#166534";
        border = "#bbf7d0";
        break;
      case 'social media marketing':
      case 'social media':
        bg = "#faf5ff";
        fg = "#6b21a8";
        border = "#e9d5ff";
        break;
      case 'branding':
        bg = "#f5f3ff";
        fg = "#5b21b6";
        border = "#ddd6fe";
        break;
      case 'website':
        bg = "#fdf2f8";
        fg = "#9d174d";
        border = "#fbcfe8";
        break;
      case 'performance marketing':
        bg = "#fff7ed";
        fg = "#c2410c";
        border = "#fed7aa";
        break;
    }

    return `<span class="service-tag" style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; background: ${bg}; color: ${fg}; border: 1px solid ${border}; margin: 2px;">${escapeHtml(name)}</span>`;
  }).join(' ');
}
