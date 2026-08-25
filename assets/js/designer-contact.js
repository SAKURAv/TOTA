// ============================================================
//  بناء زرار "تواصل مع المصمم" داخل الفوتر، بالاعتماد فقط على
//  assets/js/designer-config.js (منفصل عن باقي إعدادات الموقع).
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
  const holder = document.getElementById('designerContactHolder');
  if (!holder) return;

  const cfg = window.DESIGNER_CONFIG || {};
  const link = (cfg.designerContactLink || '').trim();
  const label = cfg.designerButtonLabel || 'تواصل مع المصمم';

  // لو اللينك فاضي، الزرار مش هيتحط خالص
  if (!link) return;

  holder.innerHTML = `
    <a class="designer-contact-btn magnetic" href="${link}" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20l9-16H3z"/>
        <path d="M12 20v-9"/>
      </svg>
      <span>${label}</span>
    </a>`;
});
