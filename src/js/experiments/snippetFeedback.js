/**
 * The SnippetFeedback class is responsible for dynamically adding a user
 * feedback form whenever a user clicks on the "copy code" button.
 *
 * This class is instantiated for each snippet in a page.
 * Most of the methods are for dynamically adding dom elements for
 * capturing user feedback.
 *
 * */
export class SnippetFeedback {
  constructor(snippetElement) {
    // Dom elements
    this.snippetElement = snippetElement;
    this.codeSnippetContainer = null;
    this.wasThisHelpfulContainer = null;
    this.feedbackForm = null;
    this.currCharCount = 0;
    this.currCharCountElement = this._makeElement({ kind: 'div' });
    this._renderCharCount();
    // For tracking user's response to be included in the final feedback form.
    this.wasThisHelpful = null;
    this._renderWasThisHelpfulPrompt();
  }

  static get MAX_CHAR_COUNT() {
    return 240;
  }

  // -- Render functions
  // These are responsible for constructing and attaching new dom elements
  // based on the user's flow in the feedback process.
  //

  /**
   * Construct a "Was this helpful" line, and inject it below the code snippet.
   */
  _renderWasThisHelpfulPrompt() {
    this.codeSnippetContainer = this.snippetElement.closest('div.highlight');
    // Create some dom elements:
    const container = this._makeElement({
      kind: 'div',
      className: 'was-this-helpful',
    });
    const textPrompt = this._makeElement({
      kind: 'span',
      text: 'Was this helpful?',
    });
    const slash = this._makeElement({ kind: 'span', text: ' / ' });
    const yesButton = this._renderYesNoButton({ text: 'Yes' });
    const noButton = this._renderYesNoButton({ text: 'No' });
    // append dom nodes.
    container.appendChild(textPrompt);
    container.appendChild(yesButton);
    container.appendChild(slash);
    container.appendChild(noButton);
    this.wasThisHelpfulContainer = container;
    this.codeSnippetContainer.appendChild(container);
  }

  /**
   * Creates the dom element for the yes/no button in the prompt.
   * */
  _renderYesNoButton({ text }) {
    let yesBtn = this._makeElement({
      kind: 'button',
      text,
      className: 'text-btn',
      onClick: () => {
        this.wasThisHelpful = text;
        this._trackYesOrNoButton(text);
        // only pop up the form if it has not yet been created.
        if (this.feedbackForm == null) {
          this._renderFeedbackForm();
        }
      },
    });

    return yesBtn;
  }

  /**
   * Renders a feedback form to the user, provided they have clicked
   * on a "yes" or "no" button in the 'was this helpful' prompt.
   * */
  _renderFeedbackForm() {
    this.currCharCount = 0;
    this._renderCharCount();
    if (!this.feedbackForm) {
      // start by constructing our dom elements
      const container = this._makeElement({ kind: 'div', className: 'form' });
      const prompt = this._makeElement({
        kind: 'div',
        text: 'Any way we can improve?',
      });

      const textForm = this._makeElement({
        kind: 'textarea',
      });

      const bottomRow = this._makeElement({
        kind: 'div',
        className: 'bottom-row',
      });

      textForm.addEventListener('input', () => {
        this.currCharCount = textForm.value.length;
        if (this.currCharCount >= SnippetFeedback.MAX_CHAR_COUNT - 1) {
          textForm.value = textForm.value.substring(
            0,
            SnippetFeedback.MAX_CHAR_COUNT - 1,
          );
        }

        // every time the user types we need to re-render the dom content manually.
        this._renderCharCount();
      });

      const sendButton = this._makeElement({
        kind: 'button',
        className: 'text-btn',
        text: 'Send',
        onClick: () => {
          this._trackFormSubmission(textForm.value);
          this.wasThisHelpfulContainer.innerHTML =
            '<div>Thank you for your feedback!</div>';
        },
      });

      // build the dom nodes.
      container.appendChild(prompt);
      container.appendChild(textForm);
      bottomRow.appendChild(this.currCharCountElement);
      bottomRow.appendChild(sendButton);
      container.appendChild(bottomRow);
      this.feedbackForm = container;
      this.wasThisHelpfulContainer.appendChild(container);

      // Here we setup the document event listeners that handle hiding the form
      // when the user clicks outside of it.
      //
      // Why do we use a setTimeout with a timer of 0?
      // -> Because there is a race condition with the adding of the click
      // listeners to the document that immediately close the form when it opens
      //
      // Setting it to 0 causes the inner callback to be run asynchronously, adding it to the eventqueue
      // so that it executes after the form being opened.
      setTimeout(() => {
        const outsideClickListener = (event) => {
          if (!this.feedbackForm.contains(event.target)) {
            this.wasThisHelpfulContainer.removeChild(this.feedbackForm);
            this.feedbackForm = null;
            removeClickListener();
          }
        };

        const removeClickListener = () => {
          document.removeEventListener('click', outsideClickListener);
        };

        document.addEventListener('click', outsideClickListener);
      }, 0);
    }
  }

  /**
   * Render the char count and set it's result on the respective element.
   * */
  _renderCharCount() {
    let charCount = this.currCharCount;
    let charCountLimited = Math.min(SnippetFeedback.MAX_CHAR_COUNT, charCount)
      charCount > SnippetFeedback.MAX_CHAR_COUNT
        ? SnippetFeedback.MAX_CHAR_COUNT
        : charCount;
    const el = `
        <div class="charCountRow">
          <span>${charCountLimited} / ${SnippetFeedback.MAX_CHAR_COUNT}</span>
        </div>`;
    this.currCharCountElement.innerHTML = el;
  }

  // -- Trackers --
  // These are responsible for sending data based on user input
  // to amplitude.

  /**
   * _trackYesOrNoButton sends a trackAction to aplitude.
   * actions are: "docs-snippet-helpful-no"  and "docs-snippet-helpful-yes"
   * */
  _trackYesOrNoButton(yesOrNoString) {
    const date = new Date();
    window.AnalyticsClient.trackAction(
      `docs-snippet-helpful-${yesOrNoString}`,
      {
        originatingSnippet: this.snippetElement.textContent,
        location: window.location.pathname,
        timeOfButtonClick: date.toISOString(),
      },
    );
  }

  /**
   * `_trackFormSubmission` invokes trackAction with a payload of the original
   * snippet, the feedback of the user, and the timeOfFormSubmission.
   * */
  _trackFormSubmission(formContent) {
    const date = new Date();
    window.AnalyticsClient.trackAction(`docs-snippet-helpful-form-submission`, {
      originatingSnippet: this.snippetElement.textContent,
      feedback: formContent,
      location: window.location.pathname,
      wasThisHelpful: this.wasThisHelpful,
      // for diffing this against the time that the _trackYesOrNoButton was clicked
      // as well as possible the time the copy code button was clicked (TODO add that)
      timeOfFormSubmission: date.toISOString(),
    });
  }

  // -- Helpers --

  /**
   * Construct a dom element, setting classes, text content, class, onclick etc.
   * */
  _makeElement({ kind, text, className, onClick }) {
    let el = document.createElement(kind);
    if (text) el.textContent = text;
    if (className) el.classList.add(className);
    if (onClick) el.addEventListener('click', onClick);

    return el;
  }
}

/**
 * init queries the dom for all snipppets
 * */
function init() {
  // https://app.optimizely.com/v2/projects/16812830475/experiments/20931242909/variations
  window.OptimizelyClient.getVariationName({
    experimentKey: 'dd_docs_snippet_feedback_experiment_test',
    groupExperimentName: 'q4_fy22_docs_disco_experiment_group_test',
    experimentContainer: '.hljs',
  }).then((variation) => {
    if (variation === 'treatment') {
      const snippets = document.querySelectorAll('.code-badge-copy-icon');
      [...snippets].forEach((snippetBlock) => {
        snippetBlock.addEventListener(
          'click',
          (pointerEvent) => {
            let snippetElement = pointerEvent.target;
            new SnippetFeedback(snippetElement);
          },
          { once: true },
        );
      });
    }
  });
}

$(() => {
  init();
});
