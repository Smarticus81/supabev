"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

interface Voice {
  id: string;
  name: string;
}

export function SettingsView() {
  const [provider, setProvider] = useState("openai");
  const [voice, setVoice] = useState("nova");
  const [rate, setRate] = useState(1.0);
  const [temperature, setTemperature] = useState(0.5);
  const [availableVoices, setAvailableVoices] = useState<Voice[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  
  // Advanced Voice Detection Settings
  const [vadThreshold, setVadThreshold] = useState(0.5);
  const [prefixPadding, setPrefixPadding] = useState(200);
  const [silenceDuration, setSilenceDuration] = useState(300);
  
  // Response Settings
  const [maxTokens, setMaxTokens] = useState(1500);
  const [responseStyle, setResponseStyle] = useState("efficient");
  
  // Audio Settings
  const [audioGain, setAudioGain] = useState(1.0);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  
  // Personality Settings
  const [personalityMode, setPersonalityMode] = useState("professional");
  const [verbosity, setVerbosity] = useState("balanced");
  
  // Business Settings
  const [venueName, setVenueName] = useState("Knotting Hill Place Estate");
  const [venueLocation, setVenueLocation] = useState("Little Elm, TX");
  const [defaultTaxRate, setDefaultTaxRate] = useState(8.25);
  const [currency, setCurrency] = useState("USD");
  const [timeZone, setTimeZone] = useState("America/Chicago");
  
  // Integration Settings
  const [enableLearning, setEnableLearning] = useState(true);
  const [enableAnalytics, setEnableAnalytics] = useState(true);
  const [enableVoiceOrdering, setEnableVoiceOrdering] = useState(true);
  const [enableInventoryManagement, setEnableInventoryManagement] = useState(true);
  const [enableEventBooking, setEnableEventBooking] = useState(true);
  
  // Security & Access Settings
  const [requireStaffPin, setRequireStaffPin] = useState(false);
  const [enableAuditLog, setEnableAuditLog] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState(30);
  
  // Notification Settings
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [enableEmailNotifications, setEnableEmailNotifications] = useState(false);
  const [notificationEmail, setNotificationEmail] = useState("");
  
  const { toast } = useToast();

  const providers = [
    { id: "openai", name: "OpenAI" },
    { id: "elevenlabs", name: "ElevenLabs" },
    { id: "deepgram", name: "Deepgram" },
    { id: "hume", name: "Hume" },
    { id: "rime", name: "RIME" },
  ];

  const openaiVoices = [
    { id: "nova", name: "Nova" },
    { id: "alloy", name: "Alloy" },
    { id: "echo", name: "Echo" },
    { id: "fable", name: "Fable" },
    { id: "onyx", name: "Onyx" },
    { id: "shimmer", name: "Shimmer" },
  ];

  const responseStyles = [
    { id: "efficient", name: "Efficient", description: "Quick, direct responses" },
    { id: "detailed", name: "Detailed", description: "Comprehensive explanations" },
    { id: "casual", name: "Casual", description: "Relaxed, conversational tone" },
    { id: "formal", name: "Formal", description: "Professional business tone" },
  ];

  const personalityModes = [
    { id: "professional", name: "Professional", description: "Business-focused, sophisticated" },
    { id: "friendly", name: "Friendly", description: "Warm and approachable" },
    { id: "expert", name: "Expert", description: "Knowledgeable, authoritative" },
    { id: "casual", name: "Casual", description: "Laid-back, conversational" },
  ];

  const verbosityLevels = [
    { id: "concise", name: "Concise", description: "Minimal, essential information only" },
    { id: "balanced", name: "Balanced", description: "Appropriate detail level" },
    { id: "detailed", name: "Detailed", description: "Comprehensive explanations" },
  ];

  useEffect(() => {
    // Load current configuration
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        if (data.tts_provider) setProvider(data.tts_provider);
        if (data.tts_voice) setVoice(data.tts_voice);
        if (data.voice) setVoice(data.voice); // Fallback for OpenAI config
        if (data.rate !== undefined) setRate(data.rate);
        if (data.temperature !== undefined) setTemperature(data.temperature);
        
        // Load advanced settings with defaults
        if (data.vad_threshold !== undefined) setVadThreshold(data.vad_threshold);
        if (data.prefix_padding !== undefined) setPrefixPadding(data.prefix_padding);
        if (data.silence_duration !== undefined) setSilenceDuration(data.silence_duration);
        if (data.max_tokens !== undefined) setMaxTokens(data.max_tokens);
        if (data.response_style) setResponseStyle(data.response_style);
        if (data.audio_gain !== undefined) setAudioGain(data.audio_gain);
        if (data.noise_suppression !== undefined) setNoiseSuppression(data.noise_suppression);
        if (data.echo_cancellation !== undefined) setEchoCancellation(data.echo_cancellation);
        if (data.personality_mode) setPersonalityMode(data.personality_mode);
        if (data.verbosity) setVerbosity(data.verbosity);
        
        // Load business settings
        if (data.venue_name) setVenueName(data.venue_name);
        if (data.venue_location) setVenueLocation(data.venue_location);
        if (data.default_tax_rate !== undefined) setDefaultTaxRate(data.default_tax_rate);
        if (data.currency) setCurrency(data.currency);
        if (data.time_zone) setTimeZone(data.time_zone);
        
        // Load integration settings
        if (data.enable_learning !== undefined) setEnableLearning(data.enable_learning);
        if (data.enable_analytics !== undefined) setEnableAnalytics(data.enable_analytics);
        if (data.enable_voice_ordering !== undefined) setEnableVoiceOrdering(data.enable_voice_ordering);
        if (data.enable_inventory_management !== undefined) setEnableInventoryManagement(data.enable_inventory_management);
        if (data.enable_event_booking !== undefined) setEnableEventBooking(data.enable_event_booking);
        
        // Load security settings
        if (data.require_staff_pin !== undefined) setRequireStaffPin(data.require_staff_pin);
        if (data.enable_audit_log !== undefined) setEnableAuditLog(data.enable_audit_log);
        if (data.session_timeout !== undefined) setSessionTimeout(data.session_timeout);
        
        // Load notification settings
        if (data.low_stock_threshold !== undefined) setLowStockThreshold(data.low_stock_threshold);
        if (data.enable_email_notifications !== undefined) setEnableEmailNotifications(data.enable_email_notifications);
        if (data.notification_email) setNotificationEmail(data.notification_email);
      })
      .catch((error) => {
        console.error("Failed to load config:", error);
      });
  }, []);

  useEffect(() => {
    // Load voices when provider changes
    if (provider === "openai") {
      setAvailableVoices(openaiVoices);
      // Reset voice selection if current voice not available for OpenAI
      if (!openaiVoices.find((v) => v.id === voice)) {
        setVoice("nova");
      }
    } else {
      setIsLoadingVoices(true);
      fetch(`/api/tts/voices?provider=${provider}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.voices) {
            setAvailableVoices(data.voices);
            // Reset voice selection if current voice not available
            if (!data.voices.find((v: Voice) => v.id === voice)) {
              setVoice(data.voices[0]?.id || "");
            }
          }
        })
        .catch((error) => {
          console.error("Failed to load voices:", error);
          setAvailableVoices([]);
        })
        .finally(() => {
          setIsLoadingVoices(false);
        });
    }
  }, [provider]);

  const handleSave = async () => {
    try {
      const baseConfig = {
        rate,
        temperature,
        vad_threshold: vadThreshold,
        prefix_padding: prefixPadding,
        silence_duration: silenceDuration,
        max_tokens: maxTokens,
        response_style: responseStyle,
        audio_gain: audioGain,
        noise_suppression: noiseSuppression,
        echo_cancellation: echoCancellation,
        personality_mode: personalityMode,
        verbosity: verbosity,
        // Business settings
        venue_name: venueName,
        venue_location: venueLocation,
        default_tax_rate: defaultTaxRate,
        currency: currency,
        time_zone: timeZone,
        // Integration settings
        enable_learning: enableLearning,
        enable_analytics: enableAnalytics,
        enable_voice_ordering: enableVoiceOrdering,
        enable_inventory_management: enableInventoryManagement,
        enable_event_booking: enableEventBooking,
        // Security settings
        require_staff_pin: requireStaffPin,
        enable_audit_log: enableAuditLog,
        session_timeout: sessionTimeout,
        // Notification settings
        low_stock_threshold: lowStockThreshold,
        enable_email_notifications: enableEmailNotifications,
        notification_email: notificationEmail,
      };

      const configData = provider === "openai" 
        ? { voice, ...baseConfig }
        : { tts_provider: provider, tts_voice: voice, ...baseConfig };

      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configData),
      });
      
      if (!response.ok) throw new Error("Failed to save settings");
      
      toast({
        title: "Settings Saved",
        description: "All configuration settings have been updated and will take effect immediately.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not save settings.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voice Agent Settings</CardTitle>
        <CardDescription>
          Configure all aspects of the voice agent behavior, audio processing, and conversation style.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="voice" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="voice">Voice & Audio</TabsTrigger>
            <TabsTrigger value="behavior">Behavior</TabsTrigger>
            <TabsTrigger value="detection">Detection</TabsTrigger>
            <TabsTrigger value="business">Business</TabsTrigger>
            <TabsTrigger value="integrations">Features</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="voice" className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="provider">Voice Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a voice provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.id === "openai" ? "(Real-time)" : "(TTS only)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {provider !== "openai" && (
                <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md border border-amber-200">
                  ⚠️ <strong>Note:</strong> Only OpenAI voices support real-time conversation with the voice agent. 
                  Other providers will only be used for text-to-speech playback, not interactive conversation.
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="voice">Voice Character</Label>
              <Select value={voice} onValueChange={setVoice} disabled={isLoadingVoices}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingVoices ? "Loading voices..." : "Select a voice"} />
                </SelectTrigger>
                <SelectContent>
                  {availableVoices.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate">Speech Rate: {rate.toFixed(2)}x</Label>
              <Slider
                id="rate"
                min={0.25}
                max={4.0}
                step={0.05}
                value={[rate]}
                onValueChange={(value) => setRate(value[0])}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground">
                Adjust how fast the voice agent speaks (0.25x - 4.0x)
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audioGain">Audio Gain: {audioGain.toFixed(2)}x</Label>
              <Slider
                id="audioGain"
                min={0.1}
                max={3.0}
                step={0.1}
                value={[audioGain]}
                onValueChange={(value) => setAudioGain(value[0])}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground">
                Control the output volume level (0.1x - 3.0x)
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="noiseSuppression"
                  checked={noiseSuppression}
                  onCheckedChange={setNoiseSuppression}
                />
                <Label htmlFor="noiseSuppression">Noise Suppression</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="echoCancellation"
                  checked={echoCancellation}
                  onCheckedChange={setEchoCancellation}
                />
                <Label htmlFor="echoCancellation">Echo Cancellation</Label>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="behavior" className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="personalityMode">Personality Mode</Label>
              <Select value={personalityMode} onValueChange={setPersonalityMode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select personality mode" />
                </SelectTrigger>
                <SelectContent>
                  {personalityModes.map((mode) => (
                    <SelectItem key={mode.id} value={mode.id}>
                      <div>
                        <div className="font-medium">{mode.name}</div>
                        <div className="text-xs text-muted-foreground">{mode.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="responseStyle">Response Style</Label>
              <Select value={responseStyle} onValueChange={setResponseStyle}>
                <SelectTrigger>
                  <SelectValue placeholder="Select response style" />
                </SelectTrigger>
                <SelectContent>
                  {responseStyles.map((style) => (
                    <SelectItem key={style.id} value={style.id}>
                      <div>
                        <div className="font-medium">{style.name}</div>
                        <div className="text-xs text-muted-foreground">{style.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verbosity">Response Detail Level</Label>
              <Select value={verbosity} onValueChange={setVerbosity}>
                <SelectTrigger>
                  <SelectValue placeholder="Select verbosity level" />
                </SelectTrigger>
                <SelectContent>
                  {verbosityLevels.map((level) => (
                    <SelectItem key={level.id} value={level.id}>
                      <div>
                        <div className="font-medium">{level.name}</div>
                        <div className="text-xs text-muted-foreground">{level.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="temperature">
                Creativity/Temperature: {temperature.toFixed(2)}
              </Label>
              <Slider
                id="temperature"
                min={0}
                max={1}
                step={0.05}
                value={[temperature]}
                onValueChange={(value) => setTemperature(value[0])}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground">
                Higher values make responses more creative and varied, lower values more consistent
              </div>
            </div>
          </TabsContent>

          <TabsContent value="detection" className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="vadThreshold">
                Voice Activity Detection Threshold: {vadThreshold.toFixed(2)}
              </Label>
              <Slider
                id="vadThreshold"
                min={0.1}
                max={1.0}
                step={0.05}
                value={[vadThreshold]}
                onValueChange={(value) => setVadThreshold(value[0])}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground">
                How sensitive the system is to detecting speech. Higher = less sensitive to background noise
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prefixPadding">
                Prefix Padding: {prefixPadding}ms
              </Label>
              <Slider
                id="prefixPadding"
                min={50}
                max={500}
                step={25}
                value={[prefixPadding]}
                onValueChange={(value) => setPrefixPadding(value[0])}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground">
                Extra audio captured before speech detection. Higher = better word capture
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="silenceDuration">
                Silence Duration: {silenceDuration}ms
              </Label>
              <Slider
                id="silenceDuration"
                min={100}
                max={2000}
                step={50}
                value={[silenceDuration]}
                onValueChange={(value) => setSilenceDuration(value[0])}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground">
                How long to wait for silence before ending speech detection. Lower = faster responses
              </div>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="maxTokens">
                Max Response Tokens: {maxTokens}
              </Label>
              <Slider
                id="maxTokens"
                min={100}
                max={4000}
                step={100}
                value={[maxTokens]}
                onValueChange={(value) => setMaxTokens(value[0])}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground">
                Maximum length of AI responses. Higher = longer responses, lower = more concise
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium mb-2">Current Configuration Summary</h4>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <div>Provider: {provider} | Voice: {voice}</div>
                  <div>Speech Rate: {rate.toFixed(2)}x | Temperature: {temperature.toFixed(2)}</div>
                  <div>VAD Threshold: {vadThreshold.toFixed(2)} | Silence: {silenceDuration}ms</div>
                  <div>Style: {responseStyle} | Personality: {personalityMode}</div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="business" className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="venueName">Venue Name</Label>
                <Input
                  id="venueName"
                  type="text"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  placeholder="Your venue name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venueLocation">Venue Location</Label>
                <Input
                  id="venueLocation"
                  type="text"
                  value={venueLocation}
                  onChange={(e) => setVenueLocation(e.target.value)}
                  placeholder="City, State"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="defaultTaxRate">Default Tax Rate (%)</Label>
                <Slider
                  id="defaultTaxRate"
                  min={0}
                  max={15}
                  step={0.25}
                  value={[defaultTaxRate]}
                  onValueChange={(value) => setDefaultTaxRate(value[0])}
                  className="w-full"
                />
                <div className="text-xs text-muted-foreground">
                  Current rate: {defaultTaxRate.toFixed(2)}%
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="CAD">CAD (C$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeZone">Time Zone</Label>
              <Select value={timeZone} onValueChange={setTimeZone}>
                <SelectTrigger>
                  <SelectValue placeholder="Select time zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">Eastern Time</SelectItem>
                  <SelectItem value="America/Chicago">Central Time</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                  <SelectItem value="Europe/London">London</SelectItem>
                  <SelectItem value="Europe/Paris">Paris</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lowStockThreshold">Low Stock Alert Threshold</Label>
              <Slider
                id="lowStockThreshold"
                min={1}
                max={20}
                step={1}
                value={[lowStockThreshold]}
                onValueChange={(value) => setLowStockThreshold(value[0])}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground">
                Alert when inventory drops below {lowStockThreshold} units
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enableEmailNotifications"
                    checked={enableEmailNotifications}
                    onCheckedChange={setEnableEmailNotifications}
                  />
                  <Label htmlFor="enableEmailNotifications">Email Notifications</Label>
                </div>
                {enableEmailNotifications && (
                  <Input
                    type="email"
                    value={notificationEmail}
                    onChange={(e) => setNotificationEmail(e.target.value)}
                    placeholder="notification@yourvenue.com"
                  />
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <div className="space-y-4">
              <h4 className="font-medium">Voice Agent Features</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enableVoiceOrdering"
                    checked={enableVoiceOrdering}
                    onCheckedChange={setEnableVoiceOrdering}
                  />
                  <Label htmlFor="enableVoiceOrdering">Voice Ordering</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enableInventoryManagement"
                    checked={enableInventoryManagement}
                    onCheckedChange={setEnableInventoryManagement}
                  />
                  <Label htmlFor="enableInventoryManagement">Inventory Management</Label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enableEventBooking"
                    checked={enableEventBooking}
                    onCheckedChange={setEnableEventBooking}
                  />
                  <Label htmlFor="enableEventBooking">Event Booking</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enableAnalytics"
                    checked={enableAnalytics}
                    onCheckedChange={setEnableAnalytics}
                  />
                  <Label htmlFor="enableAnalytics">Analytics & Reporting</Label>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Learning & Intelligence</h4>
              <div className="flex items-center space-x-2">
                <Switch
                  id="enableLearning"
                  checked={enableLearning}
                  onCheckedChange={setEnableLearning}
                />
                <Label htmlFor="enableLearning">AI Learning System</Label>
              </div>
              <div className="text-sm text-muted-foreground">
                Enable Bev to learn from interactions and improve responses over time
              </div>
            </div>

            <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
              <h4 className="font-medium mb-2 text-blue-800 dark:text-blue-200">
                🎤 Voice Menu Management
              </h4>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="mb-2">Bev can now create and manage menu items through voice commands:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>"Hey Bev, create a new drink" - Add new beverages to the menu</li>
                  <li>"Remove [drink name] from the menu" - Delete existing items</li>
                  <li>"Update the price of [drink name]" - Modify pricing</li>
                  <li>"Add inventory for [drink name]" - Update stock levels</li>
                </ul>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <div className="space-y-4">
              <h4 className="font-medium">Access Control</h4>
              <div className="flex items-center space-x-2">
                <Switch
                  id="requireStaffPin"
                  checked={requireStaffPin}
                  onCheckedChange={setRequireStaffPin}
                />
                <Label htmlFor="requireStaffPin">Require Staff PIN for POS Access</Label>
              </div>
              <div className="text-sm text-muted-foreground">
                Staff must enter their PIN before accessing the POS system
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Session Management</h4>
              <div className="space-y-2">
                <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                <Slider
                  id="sessionTimeout"
                  min={5}
                  max={120}
                  step={5}
                  value={[sessionTimeout]}
                  onValueChange={(value) => setSessionTimeout(value[0])}
                  className="w-full"
                />
                <div className="text-xs text-muted-foreground">
                  Auto-logout after {sessionTimeout} minutes of inactivity
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Audit & Compliance</h4>
              <div className="flex items-center space-x-2">
                <Switch
                  id="enableAuditLog"
                  checked={enableAuditLog}
                  onCheckedChange={setEnableAuditLog}
                />
                <Label htmlFor="enableAuditLog">Enable Audit Logging</Label>
              </div>
              <div className="text-sm text-muted-foreground">
                Track all system actions for compliance and security monitoring
              </div>
            </div>

            <div className="p-4 border rounded-lg bg-amber-50 dark:bg-amber-950">
              <h4 className="font-medium mb-2 text-amber-800 dark:text-amber-200">
                🔐 Security Best Practices
              </h4>
              <div className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                <p>• Regular staff PIN rotation recommended</p>
                <p>• Monitor audit logs for unusual activity</p>
                <p>• Enable session timeouts for shared devices</p>
                <p>• Keep OpenAI API keys secure and rotate regularly</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="px-6 py-4">
        <div className="w-full space-y-3">
          {/* Enhanced save button with modern design */}
          <Button 
            onClick={handleSave} 
            className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Save All Settings
          </Button>
          
          {/* Status indicator */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Auto-sync enabled</span>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
