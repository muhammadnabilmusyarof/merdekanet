import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Sparkles,
  Play,
  Square,
  RotateCcw,
  CheckCircle,
  Users,
  Maximize2,
  Minimize2,
  ChevronDown,
  MapPin,
  Flame,
  PhoneCall,
  Wifi,
  Compass
} from 'lucide-react';
import { sound } from '../lib/audio';
import { broadcastSpinCommand, subscribeSpinCommands, subscribeRealtimeStatus } from '../lib/spinSync';

// Curated Vibrant Official Festival Wheel Sector Palette (Trustworthy, corporate festival, clean)
const SLICE_COLORS = [
  '#1d4ed8', // Royal Sapphire Blue
  '#059669', // Emerald Berkah
  '#d97706', // Warm Amber Gold
  '#0284c7', // Sky Cerulean
  '#7c3aed', // Royal Amethyst
  '#0891b2', // Vibrant Cyan
  '#2563eb', // Cobalt Blue
  '#10b981', // Mint Emerald
  '#f59e0b', // Sun Gold
  '#4338ca', // Deep Indigo
];

export default function LiveStage({
  tickets,
  prizes,
  selectedPrize,
  setSelectedPrize,
  onMarkWinner,
  latestIncomingTicket,
  isUsingSupabase,
  isAdmin = false
}) {
  const [isRolling, setIsRolling] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [winnerTicket, setWinnerTicket] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [realtimeStatus, setRealtimeStatus] = useState('CONNECTING');
  // Tampilan 360° penuh saat standby & berputar, otomatis Zoom Makro di sekitar jarum saat KUNCI ditekan
  const isZoomed = isStopping || Boolean(winnerTicket);
  const isZoomedRef = useRef(isZoomed);

  // Active ticket currently under the needle
  const [activeTicket, setActiveTicket] = useState(null);
  const [activeTicketIndex, setActiveTicketIndex] = useState(0);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const offscreenWheelRef = useRef(null);
  const animFrameRef = useRef(null);

  // Physics animation state
  const physicsRef = useRef({
    status: 'idle', // 'idle' | 'spinning' | 'decelerating'
    rotation: 0, // current angle in radians
    speed: 0, // angular velocity (rad/frame)
    startRotation: 0,
    targetRotation: 0,
    startTime: 0,
    duration: 6500, // deceleration duration
    chosenWinner: null,
    winnerIndex: 0,
    lastPegIndex: -1,
    flapperDeflection: 0, // angle of needle flapper deflection
    zoomProgress: 0.0, // Continuous optical camera zoom: 0.0 (Full 360°) -> 1.0 (Macro Zoom)
    targetZoom: 0.0,
  });

  // Eligible tickets (ready to be drawn)
  const eligibleTickets = tickets.filter((t) => t.status === 'eligible');

  // Track prize quota usage
  const getPrizeWonCount = (prizeName) => {
    return tickets.filter((t) => t.status === 'won' && t.prize_won === prizeName).length;
  };

  // Pre-render the wheel disc to an offscreen canvas for locked 60FPS even with 2000+ items!
  const buildOffscreenWheel = useCallback(() => {
    const total = eligibleTickets.length;
    const size = 1000; // High-res master texture
    const center = size / 2;
    const outerRadius = size / 2 - 25;
    const innerRadius = 85;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = size;
    offCanvas.height = size;
    const ctx = offCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, size, size);

    // If no eligible tickets, draw placeholder wheel
    const itemCount = total > 0 ? total : 8;
    const sliceAngle = (2 * Math.PI) / itemCount;

    // Draw Slices
    for (let i = 0; i < itemCount; i++) {
      const startAngle = i * sliceAngle;
      const endAngle = startAngle + sliceAngle;
      const color = SLICE_COLORS[i % SLICE_COLORS.length];

      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, outerRadius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // Delicate sector divider lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = total > 300 ? 0.5 : total > 80 ? 1 : 2;
      ctx.stroke();

      // Text Labels
      if (itemCount <= 80) {
        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(startAngle + sliceAngle / 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';

        if (itemCount <= 24) {
          // Full ticket number & name for small sets
          ctx.font = 'bold 20px "JetBrains Mono", monospace';
          const ticketObj = total > 0 ? eligibleTickets[i] : null;
          const label = ticketObj ? ticketObj.receipt_number.replace('MN-2026-', '') : `#${i + 1}`;
          ctx.fillText(label, outerRadius - 35, 0);

          if (ticketObj) {
            ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            const shortName = ticketObj.member_name.split(' ')[0];
            ctx.fillText(shortName, outerRadius - 105, 0);
          }
        } else {
          // Condensed ticket numbers for medium sets
          ctx.font = 'bold 16px "JetBrains Mono", monospace';
          const ticketObj = total > 0 ? eligibleTickets[i] : null;
          const label = ticketObj ? ticketObj.receipt_number.replace('MN-2026-', '') : String(i + 1);
          ctx.fillText(label, outerRadius - 28, 0);
        }
        ctx.restore();
      }
    }

    // Outer wheel track ring
    ctx.beginPath();
    ctx.arc(center, center, outerRadius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 14;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(center, center, outerRadius + 6, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Outer Chrome & Gold Pegs (Pins)
    const pegCount = Math.min(Math.max(itemCount, 24), 72);
    for (let p = 0; p < pegCount; p++) {
      const pegAngle = (p * 2 * Math.PI) / pegCount;
      const px = center + Math.cos(pegAngle) * (outerRadius - 2);
      const py = center + Math.sin(pegAngle) * (outerRadius - 2);

      // Peg Shadow
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fill();

      // Peg Brass Stud
      const pegGrad = ctx.createRadialGradient(px - 2, py - 2, 1, px, py, 6);
      pegGrad.addColorStop(0, '#ffffff');
      pegGrad.addColorStop(0.4, '#fde047');
      pegGrad.addColorStop(1, '#854d0e');
      ctx.beginPath();
      ctx.arc(px, py, 5.5, 0, 2 * Math.PI);
      ctx.fillStyle = pegGrad;
      ctx.fill();
    }

    // Inner Cutout / Dark Shadow before hub
    ctx.beginPath();
    ctx.arc(center, center, innerRadius + 10, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();

    return offCanvas;
  }, [eligibleTickets]);

  // Rebuild offscreen wheel when tickets change and not rolling
  useEffect(() => {
    if (isRolling) return;
    offscreenWheelRef.current = buildOffscreenWheel();
  }, [buildOffscreenWheel, isRolling]);

  // Initialize active ticket
  useEffect(() => {
    if (eligibleTickets.length > 0 && !activeTicket) {
      setActiveTicket(eligibleTickets[0]);
      setActiveTicketIndex(0);
    }
  }, [eligibleTickets, activeTicket]);

  // Floating live notification
  useEffect(() => {
    if (latestIncomingTicket) {
      setNotification(latestIncomingTicket);
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [latestIncomingTicket]);

  // Fullscreen event listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Grand Multistage Confetti
  const triggerGrandConfetti = () => {
    const end = Date.now() + 3.5 * 1000;
    const colors = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#ec4899', '#fde047'];

    (function frame() {
      confetti({
        particleCount: 8,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: colors,
        zIndex: 99999,
      });
      confetti({
        particleCount: 8,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: colors,
        zIndex: 99999,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();

    setTimeout(() => {
      confetti({
        particleCount: 160,
        spread: 120,
        origin: { y: 0.5 },
        colors: ['#ffd700', '#ffae00', '#ffffff'],
        scalar: 1.25,
        zIndex: 99999,
      });
    }, 350);
  };

  // Helper to calculate which ticket is currently under the top needle (12 o'clock)
  const getTicketUnderPointer = (rotationRad) => {
    const total = eligibleTickets.length;
    if (total === 0) return { ticket: null, index: 0 };

    // Pointer is at 12 o'clock = -PI/2 (or 1.5 * PI in [0, 2PI))
    const pointerAngle = 1.5 * Math.PI;
    const sliceAngle = (2 * Math.PI) / total;

    // Angle on the rotating wheel that is currently under the pointer
    const wheelAngleUnderPointer = (pointerAngle - (rotationRad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const index = Math.floor(wheelAngleUnderPointer / sliceAngle) % total;
    return { ticket: eligibleTickets[index] || eligibleTickets[0], index };
  };

  // ==========================================
  // VIEW 1: FULL 360° CIRCULAR CASINO ROULETTE
  // ==========================================
  const drawFullRoulette = (ctx, width, height, currentRot, physics, clearBg = true) => {
    const center = width / 2;
    const centerY = height / 2 + 10;
    const wheelRadius = 185;

    // 0. Stage Background
    if (clearBg) {
      const bgGrad = ctx.createRadialGradient(center, centerY, 50, center, centerY, 440);
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(0.6, '#091e42');
      bgGrad.addColorStop(1, '#030712');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);
    }

    // 1. Draw Outer Golden Bezel & Diamond Star Lights
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, centerY, wheelRadius + 22, 0, 2 * Math.PI);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    // Metallic Bezel Gradient
    const bezelGrad = ctx.createRadialGradient(center, centerY, wheelRadius + 2, center, centerY, wheelRadius + 24);
    bezelGrad.addColorStop(0, '#78350f');
    bezelGrad.addColorStop(0.3, '#f59e0b');
    bezelGrad.addColorStop(0.7, '#d97706');
    bezelGrad.addColorStop(1, '#451a03');
    ctx.beginPath();
    ctx.arc(center, centerY, wheelRadius + 20, 0, 2 * Math.PI);
    ctx.strokeStyle = bezelGrad;
    ctx.lineWidth = 14;
    ctx.stroke();

    // 28 Diamond Festival Star Lights around perimeter
    const bulbCount = 28;
    const bulbPhase = Math.floor((Date.now() / 150) % bulbCount);
    for (let b = 0; b < bulbCount; b++) {
      const bAngle = (b * 2 * Math.PI) / bulbCount;
      const bx = center + Math.cos(bAngle) * (wheelRadius + 20);
      const by = centerY + Math.sin(bAngle) * (wheelRadius + 20);

      const isLit = (b + bulbPhase) % 2 === 0;
      ctx.beginPath();
      ctx.arc(bx, by, isLit ? 4 : 3, 0, 2 * Math.PI);
      if (isLit) {
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
      } else {
        ctx.fillStyle = '#1e3a8a';
        ctx.shadowBlur = 0;
      }
      ctx.fill();
    }
    ctx.restore();

    // 2. Draw Cached Rotating Wheel Disc
    if (offscreenWheelRef.current) {
      ctx.save();
      ctx.translate(center, centerY);
      ctx.rotate(currentRot);
      ctx.drawImage(offscreenWheelRef.current, -wheelRadius - 15, -wheelRadius - 15, (wheelRadius + 15) * 2, (wheelRadius + 15) * 2);
      ctx.restore();
    }

    // 3. Draw Center Golden 3D Hub (Merdeka Net Emblem)
    ctx.save();
    const hubGrad = ctx.createRadialGradient(center, centerY, 5, center, centerY, 55);
    hubGrad.addColorStop(0, '#ffffff');
    hubGrad.addColorStop(0.2, '#fde047');
    hubGrad.addColorStop(0.6, '#b45309');
    hubGrad.addColorStop(1, '#451a03');

    ctx.beginPath();
    ctx.arc(center, centerY, 50, 0, 2 * Math.PI);
    ctx.fillStyle = hubGrad;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 12;
    ctx.fill();

    // Inner Hub Royal Blue Disc
    ctx.beginPath();
    ctx.arc(center, centerY, 40, 0, 2 * Math.PI);
    ctx.fillStyle = '#0f172a';
    ctx.shadowBlur = 0;
    ctx.fill();

    // Center Badge Text & Logo
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 9px "Outfit", sans-serif';
    ctx.fillText('MERDEKA NET', center, centerY - 12);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px "JetBrains Mono", monospace';
    const totalCount = eligibleTickets.length;
    ctx.fillText(totalCount > 0 ? `${totalCount}` : '0', center, centerY + 3);

    ctx.fillStyle = '#93c5fd';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('KUPON AKTIF', center, centerY + 18);
    ctx.restore();

    // 4. Draw Top Needle / Indicator Flapper (at 12 o'clock)
    ctx.save();
    const needleX = center;
    const needleY = centerY - wheelRadius + 8;

    ctx.translate(needleX, needleY);
    ctx.rotate(physics.flapperDeflection);

    // Needle drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    // Outer Golden Arrow
    ctx.beginPath();
    ctx.moveTo(0, 22);
    ctx.lineTo(-13, -16);
    ctx.lineTo(13, -16);
    ctx.closePath();
    ctx.fillStyle = '#f59e0b';
    ctx.fill();

    // Inner Diamond Sky Blue Crystal
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.lineTo(-9, -12);
    ctx.lineTo(9, -12);
    ctx.closePath();
    ctx.fillStyle = '#38bdf8';
    ctx.fill();

    // Center Pin Pivot
    ctx.beginPath();
    ctx.arc(0, -12, 4.5, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  };

  // =========================================================================
  // VIEW 2: CINEMATIC MACRO VIEW (CLOSE-UP AROUND NEEDLE & PHYSICAL WHEEL ARC)
  // Transparent, authentic, numbers printed directly on visible slices!
  // =========================================================================
  const drawMacroRoulette = (ctx, width, height, currentRot, physics, clearBg = true) => {
    const total = eligibleTickets.length;
    const cx = width / 2;

    if (clearBg) {
      // 1. Studio Lighting Background (Clean Royal Navy Festival Stage)
      const bgGrad = ctx.createRadialGradient(cx, 40, 40, cx, height / 2, 440);
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(0.5, '#0c1a32');
      bgGrad.addColorStop(1, '#020617');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Dynamic Celebratory Spotlight shining down from the needle
      const spotGrad = ctx.createRadialGradient(cx, 90, 10, cx, 240, 280);
      spotGrad.addColorStop(0, 'rgba(56, 189, 248, 0.20)');
      spotGrad.addColorStop(0.4, 'rgba(245, 158, 11, 0.10)');
      spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = spotGrad;
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Wheel Arc Geometry
    // Needle tip touches the rim at y = 92
    const rimTopY = 92;
    const R = 860; // Large radius gives a majestic, realistic curved wheel rim
    const cy = rimTopY + R; // Arc center down below
    const sliceDepth = 260; // Slices extend from R to R - sliceDepth

    if (total > 0) {
      // Precise mathematical calculation of which ticket is under needle
      const pointerAngle = 1.5 * Math.PI;
      const sliceAngle = (2 * Math.PI) / total;
      const wheelAngleUnderPointer = (pointerAngle - (currentRot % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const exactIndex = wheelAngleUnderPointer / sliceAngle;
      const centerIdx = Math.floor(exactIndex) % total;
      const offsetFromCenter = exactIndex - (centerIdx + 0.5); // continuous sub-slice shift

      // Each visible slice spans delta radians on screen (~107px wide at rim!)
      const delta = 0.125;
      const visibleOffsets = [-4, -3, -2, -1, 0, 1, 2, 3, 4];

      // Draw each visible slice wedge on the curved arc
      for (const k of visibleOffsets) {
        const sliceIdx = (centerIdx + k + total) % total;
        const ticket = eligibleTickets[sliceIdx];
        if (!ticket) continue;

        // Exact screen angle for slice center relative to 12 o'clock (-PI/2)
        const sliceAngleCenter = -Math.PI / 2 + (k - offsetFromCenter) * delta;
        const startAng = sliceAngleCenter - delta / 2;
        const endAng = sliceAngleCenter + delta / 2;

        const isTarget = k === 0 && Math.abs(k - offsetFromCenter) < 0.45;

        // Draw curved slice wedge
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R, startAng, endAng);
        ctx.arc(cx, cy, R - sliceDepth, endAng, startAng, true);
        ctx.closePath();

        // Trustworthy Corporate Festival Palette (Non-slot, prestigious)
        const sliceGrad = ctx.createRadialGradient(cx, cy, R - sliceDepth, cx, cy, R);
        if (isTarget) {
          // Luminous Pure Gold for target under needle
          sliceGrad.addColorStop(0, '#78350f');
          sliceGrad.addColorStop(0.5, '#b45309');
          sliceGrad.addColorStop(1, '#f59e0b');
        } else if ((sliceIdx + 1) % 50 === 0) {
          // Emerald Berkah Grand Milestone
          sliceGrad.addColorStop(0, '#064e3b');
          sliceGrad.addColorStop(0.6, '#047857');
          sliceGrad.addColorStop(1, '#059669');
        } else if (sliceIdx % 2 === 0) {
          // Royal Sapphire Blue
          sliceGrad.addColorStop(0, '#172554');
          sliceGrad.addColorStop(0.6, '#1e40af');
          sliceGrad.addColorStop(1, '#2563eb');
        } else {
          // Deep Indigo / Royal Navy
          sliceGrad.addColorStop(0, '#0f172a');
          sliceGrad.addColorStop(0.6, '#1e1b4b');
          sliceGrad.addColorStop(1, '#312e81');
        }

        ctx.fillStyle = sliceGrad;
        ctx.fill();

        // Slice borders
        ctx.strokeStyle = isTarget ? '#fde047' : 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = isTarget ? 3.5 : 1.5;
        ctx.stroke();

        if (isTarget) {
          // Inner ambient glow
          ctx.strokeStyle = 'rgba(254, 240, 138, 0.6)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.restore();

        // 3. Draw Ticket Number Printed Directly on the Slice (Plain Number Format)
        const labelR = R - 130;
        const lx = cx + Math.cos(sliceAngleCenter) * labelR;
        const ly = cy + Math.sin(sliceAngleCenter) * labelR;

        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(sliceAngleCenter + Math.PI / 2); // Perfectly perpendicular along radius

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Luminous Ribbon Tag
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.fillStyle = isTarget ? '#fde047' : '#93c5fd';
        ctx.fillText(isTarget ? '★ KUPON TERPILIH ★' : 'NOMOR', 0, -32);

        // ENORMOUS TICKET NUMBER (Clean, bold, pure number)
        const rawNum = String(ticket.receipt_number || '').replace(/^MN-2026-/i, '');
        ctx.font = isTarget
          ? 'bold 36px "JetBrains Mono", monospace'
          : 'bold 30px "JetBrains Mono", monospace';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = isTarget ? '#f59e0b' : 'rgba(0,0,0,0.95)';
        ctx.shadowBlur = isTarget ? 16 : 6;
        ctx.fillText(rawNum, 0, 10);

        // Active Target Indicator Ribbon
        if (isTarget) {
          ctx.shadowBlur = 0;
          ctx.font = 'bold 9px sans-serif';
          ctx.fillStyle = '#fde047';
          ctx.fillText('★ KANDIDAT SAH ★', 0, -56);
        }

        ctx.restore();

        // 4. Chrome / Brass Divider Peg Pin at slice boundary
        const pegX = cx + Math.cos(endAng) * (R - 5);
        const pegY = cy + Math.sin(endAng) * (R - 5);

        // Pin Drop Shadow
        ctx.beginPath();
        ctx.arc(pegX, pegY + 2, 7, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fill();

        // Brass Pin Stud
        const pegGrad = ctx.createRadialGradient(pegX - 2, pegY - 2, 1, pegX, pegY, 6);
        pegGrad.addColorStop(0, '#ffffff');
        pegGrad.addColorStop(0.4, '#fde047');
        pegGrad.addColorStop(1, '#854d0e');
        ctx.beginPath();
        ctx.arc(pegX, pegY, 5.5, 0, 2 * Math.PI);
        ctx.fillStyle = pegGrad;
        ctx.fill();
      }
    }

    // 5. Curved Outer Golden Bezel Rail along top rim
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R + 10, -2.1, -1.04);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 14;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, R + 16, -2.1, -1.04);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    // 6. Camera Depth of Field Vignette (Left and Right Margins)
    const vLeft = ctx.createLinearGradient(0, 0, 150, 0);
    vLeft.addColorStop(0, 'rgba(2, 6, 23, 0.98)');
    vLeft.addColorStop(0.7, 'rgba(2, 6, 23, 0.6)');
    vLeft.addColorStop(1, 'rgba(2, 6, 23, 0)');
    ctx.fillStyle = vLeft;
    ctx.fillRect(0, 0, 150, height);

    const vRight = ctx.createLinearGradient(width - 150, 0, width, 0);
    vRight.addColorStop(0, 'rgba(2, 6, 23, 0)');
    vRight.addColorStop(0.3, 'rgba(2, 6, 23, 0.6)');
    vRight.addColorStop(1, 'rgba(2, 6, 23, 0.98)');
    ctx.fillStyle = vRight;
    ctx.fillRect(width - 150, 0, 150, height);

    // 7. Top Golden Needle Pointer (Mounted at top center, pointing right at rim contact point)
    ctx.save();
    const needlePivotX = cx;
    const needlePivotY = 44;

    ctx.translate(needlePivotX, needlePivotY);
    ctx.rotate(physics.flapperDeflection);

    // Heavy needle shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 6;

    // Outer Golden Needle Frame
    ctx.beginPath();
    ctx.moveTo(0, 50); // Needle Tip directly touching the rim
    ctx.lineTo(-20, -14);
    ctx.lineTo(20, -14);
    ctx.closePath();
    ctx.fillStyle = '#f59e0b';
    ctx.fill();

    // Inner Glowing Diamond Cyan Arrowhead (Not slot ruby!)
    ctx.beginPath();
    ctx.moveTo(0, 44);
    ctx.lineTo(-14, -10);
    ctx.lineTo(14, -10);
    ctx.closePath();
    ctx.fillStyle = '#38bdf8';
    ctx.fill();

    // Diamond Pin Pivot
    ctx.beginPath();
    ctx.arc(0, -8, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // Needle Mount Header Label
    ctx.save();
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText('🎯 INDIKATOR PENETAPAN RESMI', cx, 20);
    ctx.restore();

    // 8. Broadcast Viewfinder HUD Overlays
    ctx.save();
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'left';
    ctx.fillText('⌜ SISTEM PENGUNDIAN RESMI • TERVERIFIKASI & TRANSPARAN ⌝', 20, 24);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(width - 150, 20, 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('SIARAN RESMI TERBUKA', width - 20, 24);
    ctx.restore();
  };

  // Main Canvas Render Dispatcher with Smooth Cinematic Optical Zoom
  const drawRoulette = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const physics = physicsRef.current;
    const currentRot = physics.rotation;
    const p = physics.zoomProgress;
    const cx = width / 2;

    if (p <= 0.005) {
      // Pure 360° Full Wheel View
      ctx.clearRect(0, 0, width, height);
      drawFullRoulette(ctx, width, height, currentRot, physics, true);
    } else if (p >= 0.995) {
      // Pure Macro Needle View
      ctx.clearRect(0, 0, width, height);
      drawMacroRoulette(ctx, width, height, currentRot, physics, true);
    } else {
      // Smooth Optical Dolly Zoom Transition!
      ctx.clearRect(0, 0, width, height);

      // Shared Studio Background
      const bgGrad = ctx.createRadialGradient(cx, 40, 40, cx, height / 2, 440);
      bgGrad.addColorStop(0, '#111827');
      bgGrad.addColorStop(0.5, '#090d16');
      bgGrad.addColorStop(1, '#020617');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Smoothstep curve for natural camera acceleration and deceleration
      const ease = p * p * (3 - 2 * p);

      // 1. Full Wheel zooming in towards needle
      const fullAlpha = Math.max(0, 1 - ease * 1.5);
      if (fullAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = fullAlpha;
        const fullScale = 1.0 + ease * 2.8;
        const shiftY = ease * 44;
        ctx.translate(cx, 48 + shiftY);
        ctx.scale(fullScale, fullScale);
        ctx.translate(-cx, -48);
        drawFullRoulette(ctx, width, height, currentRot, physics, false);
        ctx.restore();
      }

      // 2. Macro Wheel expanding smoothly into place
      const macroAlpha = Math.min(1, Math.max(0, (ease - 0.15) / 0.85));
      if (macroAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = macroAlpha;
        const macroScale = 0.68 + ease * 0.32;
        ctx.translate(cx, 92);
        ctx.scale(macroScale, macroScale);
        ctx.translate(-cx, -92);
        drawMacroRoulette(ctx, width, height, currentRot, physics, false);
        ctx.restore();
      }
    }
  }, [eligibleTickets]);

  // Main 60FPS Animation Loop
  const animationLoop = useCallback(
    (time) => {
      const state = physicsRef.current;
      const total = eligibleTickets.length;

      // Smooth continuous camera zoom transition (dolly zoom effect)
      const zoomDiff = state.targetZoom - state.zoomProgress;
      if (Math.abs(zoomDiff) > 0.002) {
        state.zoomProgress += zoomDiff * 0.08;
      } else {
        state.zoomProgress = state.targetZoom;
      }

      if (state.status === 'spinning') {
        // Continuous high-speed cruise rotation
        state.rotation += 0.22; // ~13 rad/s
        drawRoulette();

        // Peg tick detection
        const pegCount = Math.min(Math.max(total, 24), 72);
        const currentPeg = Math.floor((state.rotation / (2 * Math.PI)) * pegCount);
        if (currentPeg !== state.lastPegIndex) {
          state.lastPegIndex = currentPeg;
          sound.playTick(600 + Math.random() * 200, 0.18);
          // Flapper deflection bounce
          state.flapperDeflection = -0.25;
        } else {
          // Spring return to 0
          state.flapperDeflection *= 0.7;
        }

        // Update active ticket indicator
        const { ticket, index } = getTicketUnderPointer(state.rotation);
        if (ticket) {
          setActiveTicket(ticket);
          setActiveTicketIndex(index);
        }

        animFrameRef.current = requestAnimationFrame(animationLoop);
      } else if (state.status === 'decelerating') {
        const progress = Math.min(1, (time - state.startTime) / state.duration);
        // Quintic Ease-Out: 1 - (1 - p)^5
        const eased = 1 - Math.pow(1 - progress, 5);
        state.rotation = state.startRotation + (state.targetRotation - state.startRotation) * eased;

        drawRoulette();

        // Peg hit sound that naturally slows down to a crawl
        const pegCount = Math.min(Math.max(total, 24), 72);
        const currentPeg = Math.floor((state.rotation / (2 * Math.PI)) * pegCount);
        if (currentPeg !== state.lastPegIndex) {
          state.lastPegIndex = currentPeg;
          const currentSpeed = 1 - eased;
          sound.playTick(500 + currentSpeed * 250, 0.25);
          state.flapperDeflection = -0.22 * Math.max(0.2, currentSpeed);

          // In final 20% suspense crawl: play heartbeat
          if (progress > 0.75 && progress < 0.98 && currentPeg % 2 === 0) {
            sound.playHeartbeat();
          }
        } else {
          state.flapperDeflection *= 0.65;
        }

        // Live HUD update
        const { ticket, index } = getTicketUnderPointer(state.rotation);
        if (ticket) {
          setActiveTicket(ticket);
          setActiveTicketIndex(index);
        }

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animationLoop);
        } else {
          // FINALE: Snapped dead-center on winner
          state.status = 'idle';
          state.rotation = state.targetRotation;
          state.flapperDeflection = 0;
          drawRoulette();

          setTimeout(() => {
            setIsRolling(false);
            setIsStopping(false);
            setWinnerTicket(state.chosenWinner);
            sound.playWinnerFanfare();
            triggerGrandConfetti();
          }, 500);
        }
      } else {
        // Idle state: redraw and keep frame active if camera is still zooming!
        drawRoulette();
        if (Math.abs(state.targetZoom - state.zoomProgress) > 0.002) {
          animFrameRef.current = requestAnimationFrame(animationLoop);
        }
      }
    },
    [drawRoulette, eligibleTickets]
  );

  // Trigger zoom camera transition when isZoomed changes
  useEffect(() => {
    isZoomedRef.current = isZoomed;
    physicsRef.current.targetZoom = isZoomed ? 1.0 : 0.0;
    if (physicsRef.current.status === 'idle') {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(animationLoop);
    }
  }, [isZoomed, animationLoop]);

  // Redraw when tickets change or window resizes
  useEffect(() => {
    drawRoulette();
  }, [drawRoulette]);

  // CORE METHOD: START SPIN WHEEL
  const startSpinWheel = useCallback((prizeId) => {
    if (prizeId && prizes) {
      const found = prizes.find((p) => p.id === prizeId);
      if (found) setSelectedPrize(found);
    }
    setWinnerTicket(null);
    setIsRolling(true);
    setIsStopping(false);
    sound.playLeverPull();

    const state = physicsRef.current;
    state.status = 'spinning';
    state.lastPegIndex = -1;
    state.flapperDeflection = 0;

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(animationLoop);
  }, [prizes, setSelectedPrize, animationLoop]);

  // CORE METHOD: STOP SPIN WHEEL (Smooth Physical Deceleration to Chosen Winner)
  const stopSpinWheel = useCallback((winnerId) => {
    const total = eligibleTickets.length;
    if (total === 0) return;

    setIsStopping(true);
    const state = physicsRef.current;

    // Pick fair random winner candidate or match incoming winnerId
    let chosenWinner = winnerId ? eligibleTickets.find((t) => t.id === winnerId) : null;
    if (!chosenWinner) {
      chosenWinner = eligibleTickets[Math.floor(Math.random() * total)];
    }
    state.chosenWinner = chosenWinner;

    const winnerIndex = eligibleTickets.findIndex((t) => t.id === chosenWinner.id);
    state.winnerIndex = winnerIndex !== -1 ? winnerIndex : 0;

    const sliceAngle = (2 * Math.PI) / total;
    const sliceCenter = (state.winnerIndex + 0.5) * sliceAngle;
    const targetMod = ((1.5 * Math.PI - sliceCenter) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

    const currentRotation = state.rotation;
    const currentMod = (currentRotation % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

    let diff = targetMod - currentMod;
    if (diff < 0.2 * Math.PI) {
      diff += 2 * Math.PI;
    }

    const fullSpins = 7 * (2 * Math.PI);
    state.startRotation = currentRotation;
    state.targetRotation = currentRotation + fullSpins + diff;
    state.startTime = performance.now();
    state.duration = 6200;
    state.status = 'decelerating';
  }, [eligibleTickets]);

  // Keep references to latest handlers and props
  const handlersRef = useRef({});
  handlersRef.current = {
    startSpinWheel,
    stopSpinWheel,
    prizes,
    selectedPrize,
    setSelectedPrize,
    winnerTicket,
    onMarkWinner,
  };

  // Subscribe to realtime status
  useEffect(() => {
    const unsubStatus = subscribeRealtimeStatus((status) => {
      setRealtimeStatus(status);
    });
    return () => unsubStatus();
  }, []);

  // Realtime cross-tab & remote subscription: listens to Admin commands
  useEffect(() => {
    const unsubscribe = subscribeSpinCommands((cmd) => {
      const h = handlersRef.current;
      if (cmd.type === 'START_SPIN') {
        h.startSpinWheel?.(cmd.prizeId);
      } else if (cmd.type === 'STOP_SPIN') {
        h.stopSpinWheel?.(cmd.winnerId);
      } else if (cmd.type === 'CONFIRM_WINNER') {
        if (h.winnerTicket && h.onMarkWinner) {
          h.onMarkWinner(h.winnerTicket, h.selectedPrize?.name);
        }
        setWinnerTicket(null);
      } else if (cmd.type === 'CANCEL_WINNER') {
        setWinnerTicket(null);
      } else if (cmd.type === 'SELECT_PRIZE') {
        if (cmd.prizeId && h.prizes && h.setSelectedPrize) {
          const found = h.prizes.find((p) => p.id === cmd.prizeId);
          if (found) h.setSelectedPrize(found);
        }
      }
    });

    return () => unsubscribe();
  }, []); // Run ONCE on mount so subscription is never interrupted!

  // Local Admin Start Handler
  const handleStartSpin = () => {
    if (eligibleTickets.length === 0) {
      alert('Belum ada kupon yang layak diundi! Silakan input nomor kupon di halaman admin terlebih dahulu.');
      return;
    }

    const wonCount = getPrizeWonCount(selectedPrize.name);
    if (selectedPrize.quota && wonCount >= selectedPrize.quota) {
      const confirmExceed = window.confirm(
        `Perhatian: Kuota hadiah "${selectedPrize.name}" sudah terpenuhi (${wonCount}/${selectedPrize.quota} pemenang)!\n\nApakah Anda tetap ingin mengundi hadiah ini lagi?`
      );
      if (!confirmExceed) return;
    }

    broadcastSpinCommand({ type: 'START_SPIN', prizeId: selectedPrize.id });
    startSpinWheel(selectedPrize.id);
  };

  // Local Admin Stop Handler
  const handleStopSpin = () => {
    if (!isRolling || isStopping) return;
    const chosenWinner = eligibleTickets[Math.floor(Math.random() * eligibleTickets.length)];
    broadcastSpinCommand({ type: 'STOP_SPIN', winnerId: chosenWinner?.id });
    stopSpinWheel(chosenWinner?.id);
  };

  // Confirm winner
  const handleConfirmWinner = () => {
    if (!winnerTicket) return;
    broadcastSpinCommand({ type: 'CONFIRM_WINNER', winnerId: winnerTicket.id, prizeName: selectedPrize.name });
    onMarkWinner(winnerTicket, selectedPrize.name);
    setWinnerTicket(null);
  };

  // Cancel/Re-roll winner
  const handleCancelWinner = () => {
    broadcastSpinCommand({ type: 'CANCEL_WINNER' });
    setWinnerTicket(null);
  };

  // Toggle Fullscreen OBS Mode
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // 5 Neighboring tickets for ticker
  const neighborTickets = [];
  if (eligibleTickets.length > 0) {
    for (let offset = -2; offset <= 2; offset++) {
      const idx = (activeTicketIndex + offset + eligibleTickets.length) % eligibleTickets.length;
      neighborTickets.push({ ticket: eligibleTickets[idx], offset });
    }
  }

  return (
    <div
      ref={containerRef}
      className={`relative min-h-[calc(100vh-65px)] flex flex-col justify-between p-3 sm:p-5 bg-slate-950 overflow-hidden select-none ${
        isFullscreen ? 'fixed inset-0 z-50 p-6' : ''
      }`}
    >
      {/* Dynamic Festival Stage Spotlights */}
      <div className="absolute top-0 -left-20 w-[450px] h-[700px] bg-gradient-to-b from-blue-600/20 via-amber-500/10 to-transparent blur-3xl pointer-events-none transform -rotate-12 animate-spotlight-left"></div>
      <div className="absolute top-0 -right-20 w-[450px] h-[700px] bg-gradient-to-b from-cyan-500/20 via-indigo-600/10 to-transparent blur-3xl pointer-events-none transform rotate-12 animate-spotlight-right"></div>

      {/* Floating Realtime Live Notification Ticker */}
      {notification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-bounce max-w-md w-[92%] pointer-events-none">
          <div className="bg-gradient-to-r from-amber-400 via-blue-500 to-amber-400 p-[2px] rounded-xl shadow-2xl shadow-blue-600/50">
            <div className="bg-slate-950/95 backdrop-blur-md rounded-xl p-3 flex items-center gap-3 border border-amber-400/30">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-blue-600 text-white flex items-center justify-center shrink-0 shadow-lg">
                <Sparkles className="w-5 h-5 text-yellow-200" />
              </div>
              <div className="overflow-hidden">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded-full">
                    KUPON BARU MASUK
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-300">
                    {notification.receipt_number}
                  </span>
                </div>
                <p className="text-sm text-white font-semibold truncate mt-0.5">
                  Nomor Kupon Terdaftar
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2.5 mb-2 sm:mb-4">
        {/* Official Broadcast Status */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-blue-600/20 border border-blue-500/40 px-3 py-1.5 rounded-full shadow-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
            </span>
            <span className="text-xs font-bold tracking-wider text-white uppercase flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>FESTIVAL GEBYAR UNDIAN RESMI</span>
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-xs text-slate-300">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span>Kupon Siap Diundi:</span>
            <strong className="text-amber-300 font-mono font-bold">{eligibleTickets.length.toLocaleString('id-ID')}</strong>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 px-2.5 py-1.5 rounded-full text-[11px] text-slate-300">
            <span className={`w-2 h-2 rounded-full ${realtimeStatus === 'SUBSCRIBED' ? 'bg-emerald-400 animate-pulse' : realtimeStatus === 'CONNECTING' ? 'bg-amber-400' : 'bg-rose-400'}`}></span>
            <span className="text-[10px] font-bold text-slate-300">
              {realtimeStatus === 'SUBSCRIBED' ? 'Remote Sync Aktif' : 'Menghubungkan...'}
            </span>
          </div>
        </div>

        {/* Prize Selector & Fullscreen */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <select
              value={selectedPrize.id}
              onChange={(e) => {
                const found = prizes.find((p) => p.id === e.target.value);
                if (found) {
                  setSelectedPrize(found);
                  broadcastSpinCommand({ type: 'SELECT_PRIZE', prizeId: found.id });
                  sound.playTick(700);
                }
              }}
              disabled={isRolling || !isAdmin}
              className={`w-full sm:w-80 bg-slate-900 border border-amber-500/40 text-white text-xs sm:text-sm rounded-xl px-3 py-2 pr-8 appearance-none focus:outline-none focus:border-amber-400 font-bold shadow-lg ${
                isAdmin ? 'cursor-pointer' : 'cursor-default opacity-90'
              }`}
            >
              {prizes.map((p) => {
                const wonCount = getPrizeWonCount(p.name);
                const isFull = p.quota && wonCount >= p.quota;
                return (
                  <option key={p.id} value={p.id}>
                    {p.icon} {p.badge}: {p.name} ({wonCount}/{p.quota || 1}{isFull ? ' - PENUH' : ''})
                  </option>
                );
              })}
            </select>
            <ChevronDown className="w-4 h-4 text-amber-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white cursor-pointer"
            title="Layar Penuh OBS"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Center Stage */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full py-1">
        {/* Prize Showcase Header */}
        <div className="text-center mb-2 sm:mb-3 w-full">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-900/40 border border-blue-400/30 text-amber-300 text-xs font-bold uppercase tracking-wider mb-1 shadow-md">
            <Trophy className="w-3.5 h-3.5 text-yellow-300" />
            <span>PENGUNDIAN: {selectedPrize.badge}</span>
            <span className="text-[11px] text-amber-200/90 font-mono">
              ({getPrizeWonCount(selectedPrize.name)}/{selectedPrize.quota || 1} Terundi)
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-100 tracking-tight">
            {selectedPrize.icon} {selectedPrize.name}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 line-clamp-1 max-w-md mx-auto">
            {selectedPrize.description}
          </p>
        </div>

        {/* 3D OFFICIAL FESTIVAL WHEEL */}
        <div className="relative flex flex-col items-center justify-center w-full max-w-[560px]">
          {/* Status Indicator when Stopping */}
          {isStopping && (
            <div className="w-full flex justify-center mb-2">
              <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-amber-500 text-white font-black text-xs px-4 py-1.5 rounded-full shadow-lg border border-amber-300 flex items-center gap-2 uppercase tracking-wider animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                <span>MENGUNCI NOMOR KUPON PEMENANG...</span>
              </div>
            </div>
          )}

          {/* OFFICIAL STAGE DISPLAY */}
          <div className="relative w-full rounded-3xl overflow-hidden border-2 border-blue-500/40 bg-slate-950/95 shadow-[0_0_50px_rgba(37,99,235,0.2)] p-1.5 sm:p-2.5 flex flex-col items-center justify-center">
            <canvas
              ref={canvasRef}
              width={720}
              height={440}
              className={`w-full h-auto max-h-[440px] aspect-[720/440] rounded-2xl drop-shadow-2xl select-none ${
                isAdmin ? 'cursor-pointer' : 'cursor-default'
              }`}
              onClick={isAdmin ? (!isRolling ? handleStartSpin : handleStopSpin) : undefined}
            />
          </div>

          {/* SENSOR HUD: KUPON DI BAWAH JARUM (Realtime Needle Magnifier) */}
          <div
            className={`w-full mt-3 rounded-2xl p-3 sm:p-4 shadow-xl backdrop-blur-md relative overflow-hidden transition-all duration-500 ${
              isZoomed
                ? 'bg-slate-900/95 border-2 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.3)] ring-2 ring-amber-400/20'
                : 'bg-slate-900/90 border border-blue-500/30'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
                <Compass className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: isRolling ? '1s' : '8s' }} />
                <span>KUPON DI BAWAH JARUM</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                isRolling
                  ? isStopping
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/40 animate-pulse'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {isRolling ? (isStopping ? '⏳ Melambat...' : '⚡ Berputar...') : 'Siap Diundi'}
              </span>
            </div>

            {activeTicket ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-3xl sm:text-4xl font-black font-mono-num text-amber-300 tracking-tight block">
                    {String(activeTicket.receipt_number || '').replace(/^MN-2026-/i, '')}
                  </span>
                  <span className="text-xs text-slate-400 mt-0.5 block">
                    Nomor Kupon Aktif di Bawah Jarum
                  </span>
                </div>

                {/* Neighboring ticket reel preview */}
                <div className="flex items-center gap-1.5 bg-slate-950 p-2 rounded-xl border border-slate-800 self-stretch sm:self-auto justify-center overflow-hidden">
                  {neighborTickets.map(({ ticket: nb, offset }) => (
                    <div
                      key={nb.id + offset}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono-num font-bold transition-all text-center ${
                        offset === 0
                          ? 'bg-amber-500 text-slate-950 scale-105 shadow-md shadow-amber-500/40'
                          : 'bg-slate-900 text-slate-400 opacity-60'
                      }`}
                    >
                      {String(nb.receipt_number || '').replace(/^MN-2026-/i, '')}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-2 text-xs text-slate-500">
                Belum ada nomor kupon terpasang di roda undian
              </div>
            )}
          </div>
        </div>

        {/* Action Controls: If Admin, show Spin/Stop buttons. If Public screen, show Live Teleprompter */}
        <div className="mt-4 flex items-center justify-center w-full max-w-md">
          {isAdmin ? (
            !isRolling ? (
              <button
                onClick={handleStartSpin}
                disabled={eligibleTickets.length === 0}
                className="w-full py-4 px-6 rounded-xl font-extrabold text-base sm:text-lg tracking-wider flex items-center justify-center gap-2.5 shadow-xl shadow-blue-900/40 bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-500 hover:from-blue-500 hover:to-amber-400 text-white hover:scale-[1.01] active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-blue-400/30"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>🎯 PUTAR RODA UNDIAN RESMI 🎯</span>
              </button>
            ) : (
              <button
                onClick={handleStopSpin}
                disabled={isStopping}
                className={`w-full py-4 px-6 rounded-xl font-black text-base sm:text-lg tracking-wider flex items-center justify-center gap-2.5 shadow-2xl transition-all cursor-pointer ${
                  isStopping
                    ? 'bg-amber-500/80 text-slate-950 cursor-not-allowed border-2 border-amber-300'
                    : 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 hover:from-amber-300 hover:to-yellow-200 text-slate-950 shadow-amber-500/50 hover:scale-[1.02] active:scale-95 animate-pulse border-2 border-white'
                }`}
              >
                <Square className="w-5 h-5 fill-current text-slate-950" />
                <span>{isStopping ? '⏳ MENETAPKAN PEMENANG...' : '🎯 KUNCI & TETAPKAN PEMENANG 🎯'}</span>
              </button>
            )
          ) : (
            <div className="w-full py-3.5 px-5 rounded-2xl bg-slate-900/90 border border-blue-500/30 backdrop-blur-md shadow-xl flex items-center justify-center gap-2.5 text-center">
              {isRolling ? (
                isStopping ? (
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-xs sm:text-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
                    <span>⏳ PANITIA SEDANG MENGUNCI NOMOR KUPON PEMENANG...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-blue-300 font-bold text-xs sm:text-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping"></span>
                    <span>⚡ RODA UNDIAN SEDANG BERPUTAR (KONTROL ADMIN) ⚡</span>
                  </div>
                )
              ) : (
                <div className="flex items-center gap-2 text-slate-300 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>📡 Siaran Terbuka OBS • Pengundian Dikendalikan Panitia dari Ruang Admin</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Info Footer */}
      <div className="relative z-10 max-w-4xl mx-auto w-full pt-3 border-t border-slate-900 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center gap-3">
          <span>
            Total Kupon Terdaftar: <strong className="text-white font-mono">{eligibleTickets.length.toLocaleString('id-ID')}</strong>
          </span>
          <span>
            Pemenang Sah: <strong className="text-emerald-400 font-mono">{tickets.filter((t) => t.status === 'won').length}</strong>
          </span>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>{isUsingSupabase ? 'Supabase Realtime Cloud' : 'Mode Tab Sync'}</span>
        </div>
      </div>

      {/* Winner Announcement Modal */}
      {winnerTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative max-w-lg w-full bg-slate-900 border-2 border-amber-400 rounded-2xl p-6 text-center shadow-2xl overflow-hidden">
            <div className="shimmer-foil absolute inset-0 pointer-events-none"></div>

            {/* Trophy Icon */}
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center mx-auto mb-3 text-amber-400">
              <Trophy className="w-9 h-9 animate-bounce" />
            </div>

            <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider mb-2">
              🎉 PEMENANG SAH UNDIAN RESMI 🎉
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-white">
              Hadiah: <span className="text-amber-300 font-black">{selectedPrize.name}</span>
            </h3>

            {/* Certificate Box */}
            <div className="my-5 p-5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
              <span className="text-xs text-amber-400 uppercase font-black tracking-widest block mb-1">
                NOMOR KUPON PEMENANG SAH
              </span>
              <div className="text-4xl sm:text-5xl font-black font-mono-num text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-100 my-2 drop-shadow-md">
                {String(winnerTicket.receipt_number || '').replace(/^MN-2026-/i, '')}
              </div>
              <p className="text-xs text-slate-400">
                Nomor ini resmi terpilih dan disahkan oleh sistem roda undian transparan.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleConfirmWinner}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <CheckCircle className="w-4 h-4" />
                <span>KUNCI & SIMPAN PEMENANG</span>
              </button>

              <button
                onClick={handleCancelWinner}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Undi Ulang</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
