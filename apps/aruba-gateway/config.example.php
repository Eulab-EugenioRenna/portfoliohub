<?php
declare(strict_types=1);

return [
    // Generare valori casuali distinti per ogni installazione.
    'key_id' => 'portfoliohub-vps',
    'secret' => 'sostituire-con-almeno-32-caratteri-casuali',
    // Preferire una directory non pubblica e non raggiungibile dal web.
    'storage_path' => dirname(__DIR__) . '/portfoliohub-private',
    'max_object_bytes' => 107374182400, // 100 GiB
    'clock_skew_seconds' => 300,
    // Deve coincidere con STORAGE_DELETE_BATCH_SIZE sulla VPS.
    'max_batch_items' => 250,
];
