<?php
// ── No-cache : page d'admin, jamais mise en cache ─────────────────────────────
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

// ── Lecture du log ────────────────────────────────────────────────────────────
$logFile = __DIR__ . '/visits.log';
$lines   = file_exists($logFile) ? file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) : [];

$total   = count($lines);
$mobile  = 0;
$desktop = 0;
$lastVisit = '';

// Format des lignes : "2026-04-04 06:03:45 | mobile | Mozilla/5.0..."
$byDay = [];

foreach ($lines as $line) {
    $parts  = array_map('trim', explode('|', trim($line)));
    if (count($parts) < 2) continue;

    $datetime = explode(' ', $parts[0]);
    $date     = $datetime[0] ?? '';        // YYYY-MM-DD
    $time     = $datetime[1] ?? '';        // HH:MM:SS
    $device   = strtolower($parts[1]);     // mobile | desktop

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) continue;

    if (!isset($byDay[$date])) {
        $byDay[$date] = ['total' => 0, 'mobile' => 0, 'desktop' => 0];
    }
    $byDay[$date]['total']++;

    if (str_contains($device, 'mobile')) {
        $mobile++;
        $byDay[$date]['mobile']++;
    } else {
        $desktop++;
        $byDay[$date]['desktop']++;
    }
    $lastVisit = $date . ' ' . $time . ' (' . $device . ')';
}

// Tri décroissant
krsort($byDay);

// Agrégation par mois
$byMonth = [];
foreach ($byDay as $date => $data) {
    $month = substr($date, 0, 7);
    if (!isset($byMonth[$month])) {
        $byMonth[$month] = ['total' => 0, 'mobile' => 0, 'desktop' => 0, 'days' => []];
    }
    $byMonth[$month]['total']   += $data['total'];
    $byMonth[$month]['mobile']  += $data['mobile'];
    $byMonth[$month]['desktop'] += $data['desktop'];
    $byMonth[$month]['days'][$date] = $data;
}

$moisFr = [
    '01'=>'Janvier','02'=>'Février','03'=>'Mars','04'=>'Avril',
    '05'=>'Mai','06'=>'Juin','07'=>'Juillet','08'=>'Août',
    '09'=>'Septembre','10'=>'Octobre','11'=>'Novembre','12'=>'Décembre'
];

function monthLabel(string $ym, array $moisFr): string {
    [$y, $m] = explode('-', $ym);
    return ($moisFr[$m] ?? $m) . ' ' . $y;
}

function dayLabel(string $date): string {
    $ts = strtotime($date);
    $jours = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    return $jours[(int)date('w', $ts)] . ' ' . date('d', $ts);
}

?><!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>kWhiz — Statistiques</title>
<style>
  :root {
    --bg: #0f172a; --bg-card: #1e293b; --bg-elem: rgba(255,255,255,0.05);
    --border: #334155; --text: #f8fafc; --muted: #94a3b8; --faint: #475569;
    --purple: #a855f7; --pink: #ec4899; --orange: #f97316;
    --mobile-color: #a855f7; --desktop-color: #38bdf8;
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         font-size:14px; line-height:1.6; padding:16px; min-height:100vh; }
  h1 { font-size:1.4rem; font-weight:700; background:linear-gradient(90deg,var(--purple),var(--pink),var(--orange));
       -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; margin-bottom:20px; }

  .summary { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:10px; margin-bottom:24px; }
  .card { background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:14px 16px; }
  .card-label { font-size:0.72rem; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); margin-bottom:4px; }
  .card-value { font-size:1.6rem; font-weight:700; color:var(--text); }
  .card-sub { font-size:0.75rem; color:var(--faint); margin-top:2px; }

  .month-section { background:var(--bg-card); border:1px solid var(--border); border-radius:14px;
                   margin-bottom:16px; overflow:hidden; }
  .month-header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;
                  padding:14px 18px 10px; cursor:pointer; user-select:none; }
  .month-title { font-size:1rem; font-weight:600; color:var(--text); }
  .month-total { font-size:1.3rem; font-weight:700; color:var(--purple); }
  .month-meta  { font-size:0.75rem; color:var(--muted); }
  .toggle-icon { color:var(--muted); font-size:1rem; transition:transform .25s; }
  .month-section.collapsed .toggle-icon { transform:rotate(-90deg); }

  .month-chart { padding:12px 18px 6px; }
  .chart-title { font-size:0.7rem; text-transform:uppercase; letter-spacing:.06em; color:var(--faint); margin-bottom:8px; }
  .bar-row { display:flex; align-items:center; gap:8px; margin-bottom:5px; }
  .bar-date { font-size:0.72rem; color:var(--muted); width:66px; flex-shrink:0; text-align:right; }
  .bar-wrap { flex:1; background:rgba(255,255,255,0.06); border-radius:4px; height:18px; position:relative; overflow:hidden; }
  .bar-count { font-size:0.7rem; color:var(--text); position:absolute; right:6px; top:50%; transform:translateY(-50%);
               font-weight:600; pointer-events:none; }
  .bar-legend { display:flex; gap:14px; margin-bottom:10px; }
  .legend-dot { width:10px; height:10px; border-radius:2px; display:inline-block; vertical-align:middle; margin-right:4px; }

  .day-table { width:100%; border-collapse:collapse; font-size:0.8rem; }
  .day-table th { text-align:left; padding:6px 18px; color:var(--faint); font-size:0.68rem;
                  text-transform:uppercase; border-bottom:1px solid var(--border); }
  .day-table td { padding:7px 18px; border-bottom:1px solid rgba(51,65,85,0.4); }
  .day-table tr:last-child td { border-bottom:none; }
  .day-table tr:hover td { background:rgba(255,255,255,0.03); }
  .num { font-weight:600; color:var(--text); }
  .pill { display:inline-block; font-size:0.65rem; padding:2px 7px; border-radius:10px; font-weight:600; }
  .pill-m { background:rgba(168,85,247,0.18); color:#c084fc; }
  .pill-d { background:rgba(56,189,248,0.18); color:#7dd3fc; }

  .month-body { display:block; }
  .month-section.collapsed .month-body { display:none; }
  .last-visit { font-size:0.75rem; color:var(--faint); margin-bottom:20px; }
  .footer { margin-top:24px; font-size:0.72rem; color:var(--faint); text-align:center; }
</style>
</head>
<body>

<h1>⚡ kWhiz — Statistiques</h1>

<?php if ($lastVisit): ?>
<p class="last-visit">Dernière visite : <?= htmlspecialchars($lastVisit) ?></p>
<?php endif; ?>

<div class="summary">
  <div class="card">
    <div class="card-label">Total visites</div>
    <div class="card-value"><?= $total ?></div>
  </div>
  <div class="card">
    <div class="card-label">📱 Mobile</div>
    <div class="card-value"><?= $mobile ?></div>
    <div class="card-sub"><?= $total > 0 ? round($mobile/$total*100) : 0 ?>%</div>
  </div>
  <div class="card">
    <div class="card-label">🖥️ Desktop</div>
    <div class="card-value"><?= $desktop ?></div>
    <div class="card-sub"><?= $total > 0 ? round($desktop/$total*100) : 0 ?>%</div>
  </div>
  <div class="card">
    <div class="card-label">Mois actifs</div>
    <div class="card-value"><?= count($byMonth) ?></div>
  </div>
</div>

<?php foreach ($byMonth as $ym => $mdata): ?>
<?php
  $label = monthLabel($ym, $moisFr);
  $maxInMonth = 1;
  foreach ($mdata['days'] as $dd) { $maxInMonth = max($maxInMonth, $dd['total']); }
?>
<div class="month-section" id="ms-<?= $ym ?>">
  <div class="month-header" onclick="toggleMonth('<?= $ym ?>')">
    <div>
      <div class="month-title"><?= $label ?></div>
      <div class="month-meta">📱 <?= $mdata['mobile'] ?> mob · 🖥️ <?= $mdata['desktop'] ?> desk · <?= count($mdata['days']) ?> jour(s)</div>
    </div>
    <div style="display:flex;align-items:center;gap:12px;">
      <div class="month-total"><?= $mdata['total'] ?></div>
      <span class="toggle-icon">▾</span>
    </div>
  </div>

  <div class="month-body">
    <div class="month-chart">
      <div class="chart-title">Visites par jour</div>
      <div class="bar-legend">
        <span><span class="legend-dot" style="background:var(--mobile-color)"></span><span style="color:var(--muted);font-size:0.72rem;">Mobile</span></span>
        <span><span class="legend-dot" style="background:var(--desktop-color)"></span><span style="color:var(--muted);font-size:0.72rem;">Desktop</span></span>
      </div>
      <?php foreach ($mdata['days'] as $date => $dd):
        $pctBar = round($dd['total'] / $maxInMonth * 100);
        $pctMob = $dd['total'] > 0 ? round($dd['mobile'] / $dd['total'] * 100) : 0;
      ?>
      <div class="bar-row">
        <div class="bar-date"><?= dayLabel($date) ?> <?= substr($date,8,2) ?></div>
        <div class="bar-wrap">
          <div style="display:flex;height:100%;width:<?= $pctBar ?>%;">
            <?php if ($dd['mobile'] > 0): ?>
            <div style="width:<?= $pctMob ?>%;background:var(--mobile-color);height:100%;border-radius:<?= $dd['desktop']===0?'4px':'4px 0 0 4px' ?>;"></div>
            <?php endif; ?>
            <?php if ($dd['desktop'] > 0): ?>
            <div style="width:<?= 100-$pctMob ?>%;background:var(--desktop-color);height:100%;border-radius:<?= $dd['mobile']===0?'4px':'0 4px 4px 0' ?>;"></div>
            <?php endif; ?>
          </div>
          <span class="bar-count"><?= $dd['total'] ?></span>
        </div>
      </div>
      <?php endforeach; ?>
    </div>

    <table class="day-table">
      <thead>
        <tr>
          <th>Date</th><th>Total</th><th>Mobile</th><th>Desktop</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($mdata['days'] as $date => $dd): ?>
        <tr>
          <td><?= dayLabel($date) ?> <?= $date ?></td>
          <td><span class="num"><?= $dd['total'] ?></span></td>
          <td><?php if ($dd['mobile'] > 0): ?><span class="pill pill-m">📱 <?= $dd['mobile'] ?></span><?php endif; ?></td>
          <td><?php if ($dd['desktop'] > 0): ?><span class="pill pill-d">🖥️ <?= $dd['desktop'] ?></span><?php endif; ?></td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>
<?php endforeach; ?>

<div class="footer">Données issues de <code>visits.log</code> — <?= $total ?> entrée(s)</div>

<script>
function toggleMonth(ym) {
    document.getElementById('ms-' + ym).classList.toggle('collapsed');
}
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.month-section').forEach((s, i) => {
        if (i > 0) s.classList.add('collapsed');
    });
});
</script>
</body>
</html>
