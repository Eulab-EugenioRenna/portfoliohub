<?php
declare(strict_types=1);

const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function fail(int $status, string $message): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $message], JSON_UNESCAPED_SLASHES);
    exit;
}

function header_value(string $name): string
{
    $serverName = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    return trim((string) ($_SERVER[$serverName] ?? ''));
}

function object_paths(string $root, string $encodedKey): array
{
    if (!preg_match('/^[A-Za-z0-9_-]{1,2048}$/', $encodedKey)) {
        fail(400, 'Riferimento oggetto non valido');
    }
    $hash = hash('sha256', $encodedKey);
    $directory = $root . '/objects/' . substr($hash, 0, 2) . '/' . substr($hash, 2, 2);
    return [$directory, $directory . '/' . $hash . '.bin', $directory . '/' . $hash . '.json'];
}

function cleanup_nonces(array $config, string $nonceDirectory): void
{
    $marker = $nonceDirectory . '/.gc';
    if (is_file($marker) && (int) @filemtime($marker) > time() - 60) return;
    $needsCleanup = !is_file($marker) || (int) @filemtime($marker) <= time() - 60;
    $handle = @fopen($marker, 'c');
    if ($handle === false || !flock($handle, LOCK_EX | LOCK_NB)) {
        if ($handle !== false) fclose($handle);
        return;
    }
    if ($needsCleanup) {
        foreach (glob($nonceDirectory . '/*.nonce') ?: [] as $oldNonce) {
            if (@filemtime($oldNonce) < time() - ((int) $config['clock_skew_seconds'] * 2)) {
                @unlink($oldNonce);
            }
        }
        @touch($marker);
        @chmod($marker, 0600);
    }
    flock($handle, LOCK_UN);
    fclose($handle);
}

function authenticate(array $config, string $method, string $requestTarget, ?string $bodyHash = null): string
{
    $keyId = header_value('X-PH-Key-Id');
    $timestamp = header_value('X-PH-Timestamp');
    $nonce = header_value('X-PH-Nonce');
    $claimedHash = strtolower(header_value('X-PH-Content-SHA256'));
    $signature = strtolower(header_value('X-PH-Signature'));
    if ($keyId !== (string) $config['key_id'] || !ctype_digit($timestamp)) {
        fail(401, 'Autenticazione non valida');
    }
    if (abs(time() - (int) $timestamp) > (int) $config['clock_skew_seconds']) {
        fail(401, 'Richiesta scaduta');
    }
    if (!preg_match('/^[A-Za-z0-9-]{16,80}$/', $nonce)
        || !preg_match('/^[a-f0-9]{64}$/', $claimedHash)
        || !preg_match('/^[a-f0-9]{64}$/', $signature)) {
        fail(401, 'Firma non valida');
    }
    $canonical = implode("\n", [$method, $requestTarget, $timestamp, $nonce, $claimedHash]);
    $expected = hash_hmac('sha256', $canonical, (string) $config['secret']);
    if (!hash_equals($expected, $signature)) {
        fail(401, 'Firma non valida');
    }
    if ($bodyHash !== null && !hash_equals($claimedHash, $bodyHash)) fail(401, 'Contenuto non valido');

    $nonceDirectory = rtrim((string) $config['storage_path'], '/') . '/nonces';
    if (!is_dir($nonceDirectory) && !mkdir($nonceDirectory, 0700, true) && !is_dir($nonceDirectory)) {
        fail(500, 'Archivio nonce non disponibile');
    }
    cleanup_nonces($config, $nonceDirectory);
    $nonceFile = $nonceDirectory . '/' . hash('sha256', $keyId . ':' . $nonce) . '.nonce';
    $handle = @fopen($nonceFile, 'x');
    if ($handle === false) fail(409, 'Richiesta gia utilizzata');
    fwrite($handle, $timestamp);
    fclose($handle);
    @chmod($nonceFile, 0600);
    return $claimedHash;
}

function load_metadata(string $path): array
{
    if (!is_file($path)) fail(404, 'Oggetto non trovato');
    $metadata = json_decode((string) file_get_contents($path), true);
    if (!is_array($metadata) || !isset($metadata['size'], $metadata['sha256'])) fail(500, 'Metadati corrotti');
    return $metadata;
}

function send_object_headers(array $metadata): void
{
    header('X-PH-Object-Size: ' . (string) $metadata['size']);
    header('X-PH-Object-SHA256: ' . (string) $metadata['sha256']);
    header('Accept-Ranges: bytes');
    header('Cache-Control: private, no-store');
}

$configFile = getenv('PORTFOLIOHUB_GATEWAY_CONFIG') ?: __DIR__ . '/config.php';
if (!is_file($configFile)) fail(503, 'Gateway non configurato');
$config = require $configFile;
if (!is_array($config)
    || strlen((string) ($config['secret'] ?? '')) < 32
    || !isset($config['key_id'], $config['storage_path'], $config['max_object_bytes'], $config['clock_skew_seconds'])) {
    fail(503, 'Configurazione gateway non valida');
}

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$requestTarget = (string) ($_SERVER['REQUEST_URI'] ?? '/');
$path = (string) parse_url($requestTarget, PHP_URL_PATH);
$root = rtrim((string) $config['storage_path'], '/');
$maxBatchItems = (int) ($config['max_batch_items'] ?? 250);
if ($maxBatchItems < 1 || $maxBatchItems > 1000) fail(503, 'Dimensione batch non valida');

if (preg_match('#/v1/objects/batch-delete$#', $path)) {
    if ($method !== 'POST') fail(405, 'Metodo non consentito');
    $declaredLength = filter_var($_SERVER['CONTENT_LENGTH'] ?? null, FILTER_VALIDATE_INT);
    $maxBodyBytes = ($maxBatchItems * 2100) + 128;
    if ($declaredLength === false || $declaredLength < 2 || $declaredLength > $maxBodyBytes) {
        fail(413, 'Dimensione batch non consentita');
    }
    $claimedHash = authenticate($config, $method, $requestTarget);
    $body = file_get_contents('php://input', false, null, 0, $maxBodyBytes + 1);
    if ($body === false || strlen($body) !== $declaredLength || strlen($body) > $maxBodyBytes) {
        fail(400, 'Corpo batch non valido');
    }
    if (!hash_equals($claimedHash, hash('sha256', $body))) fail(401, 'Contenuto non valido');
    $payload = json_decode($body, true);
    $keys = is_array($payload) ? ($payload['keys'] ?? null) : null;
    if (!is_array($keys) || count($keys) < 1 || count($keys) > $maxBatchItems) {
        fail(400, 'Elenco oggetti non valido');
    }
    $deleted = 0;
    $missing = 0;
    foreach ($keys as $encodedKey) {
        if (!is_string($encodedKey)) fail(400, 'Riferimento oggetto non valido');
        [, $objectPath, $metadataPath] = object_paths($root, $encodedKey);
        $existed = is_file($objectPath) || is_file($metadataPath);
        if (is_file($objectPath) && !@unlink($objectPath)) fail(500, 'Cancellazione oggetto fallita');
        if (is_file($metadataPath) && !@unlink($metadataPath)) fail(500, 'Cancellazione metadati fallita');
        if ($existed) $deleted++; else $missing++;
    }
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: private, no-store');
    echo json_encode(['deleted' => $deleted, 'missing' => $missing], JSON_UNESCAPED_SLASHES);
    http_response_code(200);
    exit;
}

if (!preg_match('#/v1/objects/([A-Za-z0-9_-]+)$#', $path, $matches)) fail(404, 'Endpoint non trovato');
$encodedKey = $matches[1];
[$directory, $objectPath, $metadataPath] = object_paths($root, $encodedKey);

if ($method === 'PUT') {
    $claimedHash = authenticate($config, $method, $requestTarget);
    $declaredLength = filter_var($_SERVER['CONTENT_LENGTH'] ?? null, FILTER_VALIDATE_INT);
    if ($declaredLength === false || $declaredLength < 0 || $declaredLength > (int) $config['max_object_bytes']) {
        fail(413, 'Dimensione oggetto non consentita');
    }
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) fail(500, 'Storage non scrivibile');
    $temporary = $directory . '/.' . bin2hex(random_bytes(16)) . '.upload';
    $input = fopen('php://input', 'rb');
    $output = fopen($temporary, 'xb');
    if ($input === false || $output === false) fail(500, 'Upload non inizializzabile');
    $hash = hash_init('sha256');
    $written = 0;
    while (!feof($input)) {
        $chunk = fread($input, 1048576);
        if ($chunk === false) { @unlink($temporary); fail(400, 'Upload interrotto'); }
        if ($chunk === '') continue;
        $written += strlen($chunk);
        if ($written > (int) $config['max_object_bytes']) { @unlink($temporary); fail(413, 'Oggetto troppo grande'); }
        hash_update($hash, $chunk);
        if (fwrite($output, $chunk) !== strlen($chunk)) { @unlink($temporary); fail(507, 'Spazio storage insufficiente'); }
    }
    fclose($input);
    fflush($output);
    fclose($output);
    $actualHash = hash_final($hash);
    if ($written !== $declaredLength) { @unlink($temporary); fail(400, 'Dimensione ricevuta non valida'); }
    if (!hash_equals($claimedHash, $actualHash)) { @unlink($temporary); fail(401, 'Contenuto non valido'); }

    if (is_file($objectPath)) {
        $existing = load_metadata($metadataPath);
        @unlink($temporary);
        if ((int) $existing['size'] !== $written || !hash_equals((string) $existing['sha256'], $actualHash)) {
            fail(409, 'Riferimento gia associato a un oggetto differente');
        }
        send_object_headers($existing);
        http_response_code(200);
        exit;
    }
    if (!rename($temporary, $objectPath)) { @unlink($temporary); fail(500, 'Commit oggetto fallito'); }
    @chmod($objectPath, 0600);
    $metadata = ['key' => $encodedKey, 'size' => $written, 'sha256' => $actualHash, 'created_at' => gmdate(DATE_ATOM)];
    if (file_put_contents($metadataPath, json_encode($metadata, JSON_UNESCAPED_SLASHES), LOCK_EX) === false) {
        @unlink($objectPath);
        fail(500, 'Commit metadati fallito');
    }
    @chmod($metadataPath, 0600);
    send_object_headers($metadata);
    http_response_code(201);
    exit;
}

authenticate($config, $method, $requestTarget, EMPTY_SHA256);
if ($method === 'DELETE') {
    @unlink($objectPath);
    @unlink($metadataPath);
    http_response_code(204);
    exit;
}

$metadata = load_metadata($metadataPath);
if (!is_file($objectPath)) fail(404, 'Oggetto non trovato');
send_object_headers($metadata);
if ($method === 'HEAD') {
    header('Content-Length: ' . (string) $metadata['size']);
    http_response_code(200);
    exit;
}
if ($method !== 'GET') fail(405, 'Metodo non consentito');

$size = (int) $metadata['size'];
$start = 0;
$end = max(0, $size - 1);
$range = header_value('X-PH-Range');
if ($range === '') $range = header_value('Range');
if ($range !== '') {
    if (!preg_match('/^bytes=(\d+)-(\d+)$/', $range, $rangeMatch)) fail(416, 'Range non valido');
    $start = (int) $rangeMatch[1];
    $end = min((int) $rangeMatch[2], $size - 1);
    if ($start > $end || $start >= $size) fail(416, 'Range non soddisfacibile');
    http_response_code(206);
    header("Content-Range: bytes {$start}-{$end}/{$size}");
}
$length = $size === 0 ? 0 : $end - $start + 1;
header('Content-Type: application/octet-stream');
header('Content-Length: ' . (string) $length);
$file = fopen($objectPath, 'rb');
if ($file === false) fail(500, 'Oggetto non leggibile');
if ($start > 0) fseek($file, $start);
$remaining = $length;
while ($remaining > 0 && !feof($file)) {
    $chunk = fread($file, min(1048576, $remaining));
    if ($chunk === false) break;
    echo $chunk;
    $remaining -= strlen($chunk);
    flush();
}
fclose($file);
