$InputFile = $env:J2V_SPEECH_INPUT
$OutputFile = $env:J2V_SPEECH_OUTPUT
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$speechInput = Get-Content -LiteralPath $InputFile -Raw -Encoding UTF8 | ConvertFrom-Json
$speechEngine = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $speechVoices = @($speechEngine.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -eq $speechInput.language })
    if ($speechVoices.Count -eq 0) { throw "No local voice installed for $($speechInput.language). Configure Azure Speech or install a matching Windows voice." }
    $speechEngine.SelectVoice($speechVoices[0].VoiceInfo.Name)
    $speechEngine.SetOutputToWaveFile($OutputFile)
    $speechEngine.Speak([string]$speechInput.text)
} finally {
    $speechEngine.Dispose()
}
