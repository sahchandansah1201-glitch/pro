-- Batch BK · Stage 5H production device-provided capture metadata.
-- Extends capture metadata with device/camera evidence used by timeline QA.
-- Metadata-only: no serials, credentials, network identifiers, image paths,
-- signed URLs, raw image bytes, patient delivery, or clinical conclusions.

alter table clinical_asset_capture_metadata
  add column if not exists device_capture_profile text not null default 'unknown'
    check (device_capture_profile in ('standard_dermoscopy', 'standard_macro', 'overview', 'unknown')),
  add column if not exists lighting_profile text not null default 'unknown'
    check (lighting_profile in ('polarized', 'non_polarized', 'cross_polarized', 'ambient', 'unknown')),
  add column if not exists focus_profile text not null default 'unknown'
    check (focus_profile in ('locked', 'auto', 'manual', 'unknown')),
  add column if not exists distance_profile text not null default 'unknown'
    check (distance_profile in ('fixed', 'estimated', 'unknown')),
  add column if not exists device_calibration_status text not null default 'unknown'
    check (device_calibration_status in ('valid', 'due_soon', 'expired', 'missing', 'not_applicable', 'unknown')),
  add column if not exists device_calibration_checked_at timestamptz,
  add column if not exists device_evidence_status text not null default 'missing'
    check (device_evidence_status in ('ready', 'needs_review', 'missing'));

alter table clinical_asset_capture_metadata
  drop constraint if exists clinical_asset_capture_metadata_no_device_secret_keys;

alter table clinical_asset_capture_metadata
  add constraint clinical_asset_capture_metadata_no_device_secret_keys check (
    not (
      metadata_json ?| array[
        'deviceSerial',
        'serialNumber',
        'rawDeviceId',
        'rawDeviceIdentifier',
        'macAddress',
        'ipAddress',
        'bluetoothAddress',
        'wifiSsid',
        'credential',
        'deviceCredential'
      ]
    )
  );

create index if not exists clinical_asset_capture_metadata_device_evidence_idx
  on clinical_asset_capture_metadata (clinic_id, device_evidence_status, updated_at desc);

comment on column clinical_asset_capture_metadata.device_evidence_status is
  'Batch BK technical readiness for device-provided capture evidence. Metadata-only and never a medical measurement or diagnosis.';
