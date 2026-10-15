<?php
/**
 * Plugin Name: Certify Studio REST CORS
 * Description: Allows the Certify Studio app to call the WordPress REST API from the browser, including the Authorization header used by Application Passwords.
 * Version:     1.0.0
 *
 * INSTALL: copy this file into wp-content/mu-plugins/ (create the folder if needed).
 * Then edit certify_studio_cors_origins() below and add the exact URL of your app.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function certify_studio_cors_origins() {
	$origins = array(
		'http://localhost:5173',
		'http://127.0.0.1:5173',
		'#^https://[a-z0-9.-]+\.monkeycode-ai\.live$#i',
	);

	return apply_filters( 'certify_studio_cors_origins', $origins );
}

function certify_studio_cors_origin_allowed( $origin, $allowed ) {
	foreach ( $allowed as $entry ) {
		$entry = (string) $entry;
		if ( '' === $entry ) {
			continue;
		}
		if ( $entry === $origin ) {
			return true;
		}
		if ( strlen( $entry ) > 2 && '#' === $entry[0] && preg_match( $entry, $origin ) ) {
			return true;
		}
	}

	return false;
}

function certify_studio_send_cors_headers() {
	$origin = get_http_origin();

	if ( ! $origin || 'null' === $origin ) {
		return;
	}

	if ( ! certify_studio_cors_origin_allowed( $origin, certify_studio_cors_origins() ) ) {
		return;
	}

	header( 'Access-Control-Allow-Origin: ' . esc_url_raw( $origin ) );
	header( 'Access-Control-Allow-Methods: GET, POST, OPTIONS' );
	header( 'Access-Control-Allow-Headers: Authorization, Content-Type' );
	header( 'Access-Control-Allow-Credentials: true' );
	header( 'Access-Control-Max-Age: 86400' );
	header( 'Vary: Origin', false );
}

add_action( 'rest_api_init', 'certify_studio_send_cors_headers', 20 );

function certify_studio_is_rest_request() {
	if ( isset( $_GET['rest_route'] ) && '' !== $_GET['rest_route'] ) {
		return true;
	}
	if ( isset( $_SERVER['REQUEST_URI'] ) && false !== strpos( $_SERVER['REQUEST_URI'], '/wp-json' ) ) {
		return true;
	}

	return false;
}

function certify_studio_handle_preflight() {
	$method = isset( $_SERVER['REQUEST_METHOD'] ) ? $_SERVER['REQUEST_METHOD'] : '';
	if ( 'OPTIONS' !== $method || ! certify_studio_is_rest_request() ) {
		return;
	}

	certify_studio_send_cors_headers();
	status_header( 200 );
	exit;
}

add_action( 'init', 'certify_studio_handle_preflight', 1 );

if ( ! isset( $_SERVER['HTTP_AUTHORIZATION'] ) ) {
	if ( isset( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) ) {
		$_SERVER['HTTP_AUTHORIZATION'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
	} elseif ( function_exists( 'apache_request_headers' ) ) {
		$certify_headers = apache_request_headers();
		if ( isset( $certify_headers['Authorization'] ) ) {
			$_SERVER['HTTP_AUTHORIZATION'] = $certify_headers['Authorization'];
		} elseif ( isset( $certify_headers['authorization'] ) ) {
			$_SERVER['HTTP_AUTHORIZATION'] = $certify_headers['authorization'];
		}
	}
}
