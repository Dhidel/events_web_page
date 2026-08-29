export default function TopStrip() {
  return (
    <div className="top-strip">
      <div className="wrap">
        <span className="msg">
          <svg><use href="#i-star-fill" /></svg>
          <span>+25 años dándole vida a los eventos de Guatemala</span>
        </span>
        <div className="top-social">
          <a href="https://www.instagram.com/showcompany_gt" target="_blank" rel="noreferrer" className="s-ig" aria-label="Instagram">
            <svg><use href="#i-ig" /></svg>
          </a>
          <a href="https://www.tiktok.com/@showcompanygt" target="_blank" rel="noreferrer" className="s-tiktok" aria-label="TikTok">
            <svg><use href="#i-tiktok" /></svg>
          </a>
          <a href="https://www.facebook.com/showcompany" target="_blank" rel="noreferrer" className="s-fb" aria-label="Facebook">
            <svg><use href="#i-fb" /></svg>
          </a>
          <a href="https://www.youtube.com/@showcompanygt" target="_blank" rel="noreferrer" className="s-yt" aria-label="YouTube">
            <svg><use href="#i-yt" /></svg>
          </a>
          <a href="https://wa.me/50230738716" target="_blank" rel="noreferrer" className="s-wa" aria-label="WhatsApp">
            <svg><use href="#i-whatsapp" /></svg>
          </a>
        </div>
      </div>
    </div>
  );
}
