const feedback = document.querySelector(".feedback");
const buttons = document.querySelectorAll(".choices button");

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    buttons.forEach((choice) => choice.classList.remove("correct", "incorrect"));

    if (button.dataset.correct === "true") {
      button.classList.add("correct");
      feedback.textContent = "Correct. Nice work.";
      return;
    }

    button.classList.add("incorrect");
    feedback.textContent = "Try again.";
  });
});
