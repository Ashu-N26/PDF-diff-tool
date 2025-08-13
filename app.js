const form = document.getElementById('compareForm');
const status = document.getElementById('status');
const result = document.getElementById('result');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  status.innerText = 'Uploading and running advanced comparison... This may take a while for large PDFs.';
  result.innerHTML = '';

  const fd = new FormData(form);
  try {
    const resp = await fetch('/compare', { method: 'POST', body: fd });
    const json = await resp.json();
    if (!resp.ok) {
      status.innerText = 'Error: ' + (json.error || 'unknown');
      return;
    }
    status.innerText = 'Comparison complete.';
    const link = document.createElement('a');
    link.href = json.downloadUrl;
    link.innerText = 'Download comparison PDF';
    link.download = 'comparison_result.pdf';
    result.appendChild(link);

    const link2 = document.createElement('a');
    link2.style.display='block';
    link2.href = json.summaryUrl;
    link2.innerText = 'Download summary & artifacts (zip)';
    result.appendChild(link2);
  } catch (err) {
    status.innerText = 'Request failed: ' + err.message;
  }
});
