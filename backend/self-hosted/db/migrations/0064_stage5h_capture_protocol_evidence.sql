-- Batch BN · Stage 5H production capture protocol metadata.
-- Extends capture metadata with protocol evidence used by timeline QA.
-- Metadata-only: no EXIF payloads, GPS/location data, serials, credentials,
-- storage paths, signed URLs, raw image bytes, patient delivery, measurements,
-- or clinical conclusions.

alter table clinical_asset_capture_metadata
  add column if not exists capture_protocol_version text not null default 'unknown'
    check (capture_protocol_version in ('clinic_standard_v1', 'device_standard_v1', 'imported_standard', 'unknown')),
  add column if not exists lens_profile text not null default 'unknown'
    check (lens_profile in ('dermoscope_contact', 'dermoscope_non_contact', 'macro_lens', 'phone_camera', 'unknown')),
  add column if not exists polarization_mode text not null default 'unknown'
    check (polarization_mode in ('polarized', 'non_polarized', 'cross_polarized', 'not_applicable', 'unknown')),
  add column if not exists color_reference_status text not null default 'unknown'
    check (color_reference_status in ('captured', 'not_required', 'missing', 'unknown')),
  add column if not exists device_clock_sync_status text not null default 'unknown'
    check (device_clock_sync_status in ('synced', 'stale', 'missing', 'unknown')),
  add column if not exists capture_protocol_status text not null default 'missing'
    check (capture_protocol_status in ('ready', 'needs_review', 'missing'));

alter table clinical_asset_capture_metadata
  drop constraint if exists clinical_asset_capture_metadata_no_protocol_sensitive_keys;

alter table clinical_asset_capture_metadata
  add constraint clinical_asset_capture_metadata_no_protocol_sensitive_keys check (
    not (
      metadata_json ?| array[
        'rawExif',
        'exifJson',
        'gpsLatitude',
        'gpsLongitude',
        'gpsLocation',
        'locationCoordinates',
        'operatorName',
        'patientName',
        'rawCapturePayload',
        'firmwareSerial',
        'deviceSerial',
        'serialNumber',
        'rawDeviceId',
        'macAddress',
        'ipAddress',
        'bluetoothAddress',
        'wifiSsid',
        'credential',
        'deviceCredential'
      ]
    )
  );

create index if not exists clinical_asset_capture_metadata_protocol_evidence_idx
  on clinical_asset_capture_metadata (clinic_id, capture_protocol_status, updated_at desc);

comment on column clinical_asset_capture_metadata.capture_protocol_status is
  'Batch BN technical readiness for capture protocol evidence. Metadata-only and never a medical measurement or diagnosis.';
