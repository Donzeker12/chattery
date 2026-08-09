<?php

namespace App\Services;

final readonly class FcmSendResult
{
    public function __construct(
        public bool $successful,
        public int $status,
        public ?string $errorCode = null,
        public ?string $body = null,
    ) {}

    public function tokenIsInvalid(): bool
    {
        return in_array($this->errorCode, ['UNREGISTERED', 'SENDER_ID_MISMATCH'], true);
    }
}
