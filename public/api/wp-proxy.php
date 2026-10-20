<?php
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
	http_response_code(204);
	exit;
}

function certify_proxy_error($status, $message) {
	http_response_code($status);
	header('Content-Type: application/json; charset=UTF-8');
	echo json_encode(array('success' => false, 'message' => $message));
	exit;
}

function certify_proxy_auth() {
	$keys = array(
		'HTTP_AUTHORIZATION',
		'REDIRECT_HTTP_AUTHORIZATION',
		'HTTP_X_AUTHORIZATION',
		'HTTP_X_WP_AUTHORIZATION',
		'Authorization'
	);
	foreach ($keys as $key) {
		if (!empty($_SERVER[$key])) {
			return $_SERVER[$key];
		}
	}
	if (function_exists('apache_request_headers')) {
		$incoming = apache_request_headers();
		foreach (array('Authorization', 'authorization', 'X-Authorization', 'X-WP-Authorization') as $name) {
			if (!empty($incoming[$name])) {
				return $incoming[$name];
			}
		}
	}
	return '';
}

$target = isset($_GET['url']) ? $_GET['url'] : '';
if ($target === '') {
	certify_proxy_error(400, 'Missing url parameter.');
}

$parts = parse_url($target);
if ($parts === false || empty($parts['scheme']) || empty($parts['host'])) {
	certify_proxy_error(400, 'Invalid url parameter.');
}

$scheme = strtolower($parts['scheme']);
if ($scheme !== 'http' && $scheme !== 'https') {
	certify_proxy_error(400, 'Unsupported url protocol.');
}

$host = strtolower($parts['host']);
$private = '/^(localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|0\.0\.0\.0|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|\[?::1\]?)$/i';
if (preg_match($private, $host)) {
	certify_proxy_error(400, 'Target host is not allowed.');
}

$headers = array('Accept: application/json');
$auth = certify_proxy_auth();
if ($auth !== '') {
	$headers[] = 'Authorization: ' . $auth;
}

if (function_exists('curl_init')) {
	$ch = curl_init($target);
	curl_setopt_array($ch, array(
		CURLOPT_RETURNTRANSFER => true,
		CURLOPT_FOLLOWLOCATION => true,
		CURLOPT_MAXREDIRS => 5,
		CURLOPT_TIMEOUT => 30,
		CURLOPT_HTTPHEADER => $headers,
		CURLOPT_USERAGENT => 'CertifyStudioProxy/1.0',
		CURLOPT_HEADER => false
	));
	$body = curl_exec($ch);
	if ($body === false) {
		curl_close($ch);
		certify_proxy_error(502, 'The proxy could not reach the WordPress API.');
	}
	$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
	$content_type = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
	curl_close($ch);
	header('Content-Type: ' . ($content_type ? $content_type : 'application/json; charset=UTF-8'));
	http_response_code($status ? $status : 502);
	echo $body;
	exit;
}

$context = stream_context_create(array(
	'http' => array(
		'method' => 'GET',
		'header' => implode("\r\n", $headers),
		'timeout' => 30,
		'follow_location' => 1,
		'ignore_errors' => true
	)
));
$body = @file_get_contents($target, false, $context);
if ($body === false) {
	certify_proxy_error(502, 'The proxy could not reach the WordPress API.');
}

$status = 200;
$content_type = 'application/json; charset=UTF-8';
if (!empty($http_response_header)) {
	foreach ($http_response_header as $line) {
		if (preg_match('/^HTTP\/\S+\s+(\d+)/', $line, $match)) {
			$status = (int) $match[1];
		} elseif (stripos($line, 'Content-Type:') === 0) {
			$content_type = trim(substr($line, strlen('Content-Type:')));
		}
	}
}

header('Content-Type: ' . $content_type);
http_response_code($status);
echo $body;
