import {
  initializeApp,
  getApps,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDbrxXpL6XNtV35w_s14vbz_xv3c3rBjV4",
  authDomain: "joseline-5b910.firebaseapp.com",
  projectId: "joseline-5b910",
  storageBucket: "joseline-5b910.firebasestorage.app",
  messagingSenderId: "1000887672996",
  appId: "1:1000887672996:web:506c830b9d1f1b15950631",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

window.addEventListener("load", function () {
  const preloader = document.getElementById("preloader");
  if (preloader) {
    preloader.style.opacity = "0";
    setTimeout(() => {
      preloader.style.display = "none";
    }, 500);
  }
});

const mobileMenuBtn = document.getElementById("mobile-menu-btn");
const mobileMenuClose = document.getElementById("mobile-menu-close");
const mobileMenu = document.getElementById("mobile-menu");
const mobileMenuOverlay = document.getElementById("mobile-menu-overlay");

function openMobileMenu() {
  if (!mobileMenu) return;
  mobileMenu.classList.add("active");
  if (mobileMenuOverlay) mobileMenuOverlay.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeMobileMenu() {
  if (!mobileMenu) return;
  mobileMenu.classList.remove("active");
  if (mobileMenuOverlay) mobileMenuOverlay.classList.remove("active");
  document.body.style.overflow = "";
}

if (mobileMenuBtn) mobileMenuBtn.addEventListener("click", openMobileMenu);
if (mobileMenuClose) mobileMenuClose.addEventListener("click", closeMobileMenu);
if (mobileMenuOverlay)
  mobileMenuOverlay.addEventListener("click", closeMobileMenu);

if (mobileMenu) {
  mobileMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMobileMenu);
  });
}

const navbar = document.getElementById("navbar");
const navBg = document.getElementById("nav-bg");

window.addEventListener("scroll", function () {
  if (!navbar || !navBg) return;
  if (window.scrollY > 50) {
    navBg.style.opacity = "1";
    navbar.classList.add("shadow-lg");
  } else {
    navBg.style.opacity = "0";
    navbar.classList.remove("shadow-lg");
  }
});

const revealElements = document.querySelectorAll(
  ".reveal, .reveal-left, .reveal-right, .reveal-scale",
);

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("active");
      }
    });
  },
  {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  },
);

revealElements.forEach((el) => revealObserver.observe(el));

const counters = document.querySelectorAll(".counter");
const counterSpeed = 200;

const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const counter = entry.target;
        const target = parseInt(counter.getAttribute("data-target"));
        const updateCount = () => {
          const count = parseInt(counter.innerText);
          const increment = target / counterSpeed;
          if (count < target) {
            counter.innerText = Math.ceil(count + increment);
            setTimeout(updateCount, 1);
          } else {
            counter.innerText = target;
          }
        };
        updateCount();
        counterObserver.unobserve(counter);
      }
    });
  },
  {
    threshold: 0.5,
  },
);

counters.forEach((counter) => counterObserver.observe(counter));

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));
    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  });
});

const inquiryForm = document.getElementById("inquiry-form");
const formStatus = document.getElementById("form-status");

if (inquiryForm) {
  inquiryForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const firstName = inquiryForm.querySelector("#firstName")?.value.trim();
    const lastName = inquiryForm.querySelector("#lastName")?.value.trim();
    const email = inquiryForm.querySelector("#email")?.value.trim();
    const phone = inquiryForm.querySelector("#phone")?.value.trim();
    const position = inquiryForm.querySelector("#position")?.value;
    const message = inquiryForm.querySelector("#message")?.value.trim();

    if (!firstName || !email || !message) {
      showStatus(
        "Please fill in all required fields (First Name, Email, Message).",
        "error",
      );
      return;
    }

    const submitBtn = inquiryForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
      </svg>
      <span>Submitting...</span>
    `;

    try {
      await addDoc(collection(db, "inquiries"), {
        firstName,
        lastName,
        email,
        phone,
        position,
        message,
        status: "new",
        createdAt: serverTimestamp(),
      });

      showStatus(
        "✅ Your inquiry has been submitted! We will contact you soon.",
        "success",
      );
      inquiryForm.reset();
    } catch (err) {
      console.error("Firestore submission error:", err);
      showStatus(
        "❌ Submission failed. Please try again or email us directly.",
        "error",
      );
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

function showStatus(msg, type) {
  if (!formStatus) return;
  formStatus.textContent = msg;
  formStatus.className = `text-center mt-4 text-sm ${
    type === "success" ? "text-green-600" : "text-red-600"
  }`;
  formStatus.classList.remove("hidden");
  setTimeout(() => formStatus.classList.add("hidden"), 6000);
}

// main.js
document.addEventListener("DOMContentLoaded", function() {
    // I-verify kung gumagana: console.log("Swiper loading...");
    
    const swiper = new Swiper(".deploymentCarousel", {
        slidesPerView: 1,
        centeredSlides: true,
        speed: 800,
        navigation: {
            nextEl: ".swiper-button-next",
            prevEl: ".swiper-button-prev",
        },
        pagination: {
            el: ".swiper-pagination",
            clickable: true,
        },
        breakpoints: {
            768: { slidesPerView: 1.5 },
            1024: { slidesPerView: 2 },
        },
        observer: true,
        observeParents: true,
        watchOverflow: true
    });
});